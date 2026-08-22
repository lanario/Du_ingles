"use client";

/**
 * Área de Financeiro: uma competência por vez.
 *
 * A tela responde, de cima para baixo, às três perguntas que o admin faz
 * nessa ordem: **sobrou ou faltou este mês?** (cartão de resultado),
 * **de onde veio e para onde foi?** (indicadores e linhas de negócio) e
 * **o que falta receber ou pagar?** (a lista).
 *
 * O recorte por mês vive na URL (`?mes=2026-08`) e não em estado local: assim
 * o link de um mês fechado pode ser guardado, e voltar do formulário não joga
 * o admin de volta para o mês corrente. Busca, status e ordenação, ao
 * contrário, são locais — um mês tem dezenas de lançamentos, filtrar em
 * memória é imediato.
 *
 * Movimento: Framer Motion no ciclo de vida (abas, entrada e saída das
 * linhas, painel) e GSAP no que depende de rolagem (barra que gruda,
 * fio de progresso da lista, count-up dos valores).
 */

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  deleteFinanceEntryAction,
  reopenFinanceEntryAction,
  setFinancePaymentMethodAction,
  settleFinanceEntryAction,
} from "@/actions/admin/finance";
import { useListProgress, useStickyBar } from "@/components/motion/list-motion";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import {
  ArrowInIcon,
  ArrowOutIcon,
  CloseIcon,
  PlusIcon,
  SearchIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { FinanceDirection } from "@/schemas/finance";
import type { FinanceMonth, FinanceTrendPoint } from "@/repositories/finance";
import { EntryFormPanel } from "./entry-form-panel";
import { EntryRow } from "./entry-row";
import {
  CategoryBreakdown,
  DirectionTile,
  MonthPicker,
  ResultCard,
  StatTile,
} from "./finance-visuals";
import {
  DIRECTION_COPY,
  DIRECTION_GRADIENT,
  DIRECTION_TONE,
  entryMatches,
  formatMoney,
  matchesStateFilter,
  monthKeyTitle,
  sliceByCategory,
  sortEntries,
  suggestedDate,
  STATE_FILTER_LABEL,
  SORT_LABEL,
  type FinanceEntry,
  type SortMode,
  type StateFilter,
} from "./finance-utils";

const STATE_FILTERS: StateFilter[] = ["all", "open", "overdue", "paid"];
const SORT_MODES: SortMode[] = ["due", "amount", "description"];

interface FinanceViewProps {
  month: FinanceMonth;
  trend: FinanceTrendPoint[];
  /** Competência corrente, para o botão "mês atual". */
  currentKey: string;
}

export function FinanceView({ month, trend, currentKey }: FinanceViewProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [navigating, startNavigation] = useTransition();

  const [direction, setDirection] = useState<FinanceDirection>("in");
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [sort, setSort] = useState<SortMode>("due");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceEntry | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<FinanceEntry | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { sentinelRef, barRef } = useStickyBar<HTMLDivElement>();
  const lineRef = useListProgress(listRef);

  const { entries, totals, today } = month;
  const copy = DIRECTION_COPY[direction];
  const tone = DIRECTION_TONE[direction];

  // O lançamento aberto para edição precisa seguir o dado do servidor: depois
  // de salvar, o painel não pode continuar mostrando o snapshot antigo.
  useEffect(() => {
    setEditing((current) =>
      current ? (entries.find((entry) => entry.id === current.id) ?? null) : null,
    );
    setConfirmDelete((current) =>
      current ? (entries.find((entry) => entry.id === current.id) ?? null) : null,
    );
  }, [entries]);

  // "/" foca a busca, como nas outras listas do painel.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;
      event.preventDefault();
      searchRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const ofDirection = useMemo(
    () => entries.filter((entry) => entry.direction === direction),
    [entries, direction],
  );

  const filtered = useMemo(() => {
    const result = ofDirection.filter(
      (entry) =>
        matchesStateFilter(entry, stateFilter, today) && entryMatches(entry, search),
    );
    return sortEntries(result, sort);
  }, [ofDirection, stateFilter, search, sort, today]);

  const slices = useMemo(() => sliceByCategory(ofDirection), [ofDirection]);

  const stats =
    direction === "in"
      ? {
          total: totals.revenueCents,
          settled: totals.revenuePaidCents,
          open: totals.revenueOpenCents,
          overdue: totals.revenueOverdueCents,
        }
      : {
          total: totals.expenseCents,
          settled: totals.expensePaidCents,
          open: totals.expenseOpenCents,
          overdue: totals.expenseOverdueCents,
        };

  function goToMonth(key: string) {
    startNavigation(() => router.push(`/admin/financeiro?mes=${key}`));
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(entry: FinanceEntry) {
    setEditing(entry);
    setFormOpen(true);
  }

  async function runOnEntry(
    entryId: string,
    work: () => Promise<{ success: boolean; error?: { message: string } }>,
  ) {
    setError(null);
    setBusy(entryId);
    try {
      const result = await work();
      if (!result.success) setError(result.error?.message ?? "Falha na operação.");
      else router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const monthEmpty = entries.length === 0;
  const filtersActive = search.trim() !== "" || stateFilter !== "all";

  return (
    <div className="pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-admin-foreground sm:text-2xl">
            Financeiro
          </h1>
          <p className="mt-2 max-w-xl text-sm text-admin-foreground/60">
            Receitas e despesas de {monthKeyTitle(month.key).toLowerCase()}, separadas por
            linha de negócio. O que está liquidado vira caixa; o que está em aberto vira
            cobrança.
          </p>
        </div>

        <MonthPicker
          monthKey={month.key}
          previousKey={month.previousKey}
          nextKey={month.nextKey}
          currentKey={currentKey}
          onChange={goToMonth}
          pending={navigating}
        />
      </div>

      {/*
        O resultado do mês é a leitura principal — fica com quase dois terços
        da faixa. Receitas e despesas empilham numa coluna estreita ao lado:
        são atalhos de filtro, não painéis, e não devem competir em área com o
        cartão que responde "sobrou ou faltou".
      */}
      <div
        className={cn(
          "mt-5 grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]",
          navigating && "opacity-60 transition-opacity",
        )}
      >
        <ResultCard
          monthKey={month.key}
          totals={totals}
          trend={trend}
          onSelectMonth={goToMonth}
        />

        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-1">
          <DirectionTile
            direction="in"
            cents={totals.revenueCents}
            count={totals.revenueCount}
            active={direction === "in"}
            onSelect={() => setDirection("in")}
          />
          <DirectionTile
            direction="out"
            cents={totals.expenseCents}
            count={totals.expenseCount}
            active={direction === "out"}
            onSelect={() => setDirection("out")}
          />
        </div>
      </div>

      <div ref={sentinelRef} aria-hidden className="mt-6 h-px" />

      <div
        ref={barRef}
        data-stuck="false"
        className={cn(
          "sticky top-0 z-30 -mx-4 mb-4 md:top-16 md:-mx-6 flex flex-wrap items-center gap-2 border-b border-transparent px-4 py-3 md:px-6 sm:mb-5 sm:gap-3",
          "max-[380px]:[&>*]:min-w-0",
          "bg-[color-mix(in_srgb,var(--admin-background)_88%,transparent)] backdrop-blur-md transition-[border-color,box-shadow] duration-300",
          "data-[stuck=true]:border-admin-border data-[stuck=true]:shadow-[0_18px_30px_-28px_rgba(11,26,51,0.35)]",
        )}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px]"
        >
          <span
            ref={lineRef}
            className="block h-full w-full origin-left bg-gradient-to-r from-navy-700 to-gold-500"
          />
        </span>

        <div
          role="group"
          aria-label="Tipo de lançamento"
          className="flex items-center gap-1 rounded-xl border border-admin-border bg-admin-surface p-1"
        >
          {(["in", "out"] as const).map((option) => {
            const active = direction === option;
            const Icon = option === "in" ? ArrowInIcon : ArrowOutIcon;
            const count = option === "in" ? totals.revenueCount : totals.expenseCount;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={active}
                onClick={() => setDirection(option)}
                className={cn(
                  "relative rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors sm:px-3 sm:text-sm",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
                  active
                    ? "text-admin-foreground"
                    : "text-admin-foreground/50 hover:text-admin-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="du-financeiro-tab"
                    aria-hidden
                    className="absolute inset-0 rounded-lg bg-admin-muted shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--gold-500)_30%,transparent)]"
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 480, damping: 38 }
                    }
                  />
                )}
                <span className="relative flex items-center gap-1.5">
                  <Icon
                    className="h-3.5 w-3.5"
                    style={{ color: DIRECTION_TONE[option] }}
                  />
                  {DIRECTION_COPY[option].tab}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[10px] font-semibold tabular",
                      active
                        ? "bg-gold-100 text-gold-700"
                        : "bg-admin-muted text-admin-foreground/50",
                    )}
                  >
                    {count}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative order-last w-full min-w-[12rem] flex-1 sm:order-none sm:w-auto">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-foreground/40" />
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Buscar lançamento"
            placeholder="Buscar por descrição, aluno, fornecedor, categoria..."
            className="w-full rounded-xl border border-admin-border bg-admin-surface py-2.5 pl-10 pr-10 text-sm text-admin-foreground outline-none transition-colors placeholder:text-admin-foreground/40 hover:border-gold-300 focus:border-gold-500 focus-visible:ring-2 focus-visible:ring-gold-500/35 [&::-webkit-search-cancel-button]:hidden"
          />
          <AnimatePresence>
            {search !== "" && (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => {
                  setSearch("");
                  searchRef.current?.focus();
                }}
                aria-label="Limpar busca"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-admin-foreground/40 transition-colors hover:bg-admin-muted hover:text-admin-foreground"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <Select
          tone="admin"
          value={stateFilter}
          onChange={(next) => setStateFilter(next as StateFilter)}
          aria-label="Filtrar por status"
          className="h-[42px] w-full min-w-0 flex-1 bg-admin-surface sm:w-[10.5rem] sm:flex-none"
        >
          {STATE_FILTERS.map((item) => (
            <option key={item} value={item}>
              {STATE_FILTER_LABEL[item]}
            </option>
          ))}
        </Select>

        <div className="hidden lg:block">
          <Select
            tone="admin"
            value={sort}
            onChange={(next) => setSort(next as SortMode)}
            aria-label="Ordenar lançamentos"
            className="h-[42px] w-[10.5rem] bg-admin-surface"
          >
            {SORT_MODES.map((item) => (
              <option key={item} value={item}>
                {SORT_LABEL[item]}
              </option>
            ))}
          </Select>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className={cn(
            "inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity sm:flex-none",
            "hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
          )}
          style={{ backgroundImage: DIRECTION_GRADIENT[direction] }}
        >
          <PlusIcon className="h-4 w-4" />
          {copy.create}
        </button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        <StatTile
          label={copy.total}
          cents={stats.total}
          tone="var(--navy-800)"
          icon="coin"
          footnote={
            <span className="text-admin-foreground/45">
              {ofDirection.length} lançamento{ofDirection.length === 1 ? "" : "s"} na
              competência
            </span>
          }
        />
        <StatTile
          label={copy.settled}
          cents={stats.settled}
          tone="var(--success)"
          icon="wallet"
          delay={0.06}
          footnote={
            <span className="text-admin-foreground/45">
              {stats.total > 0
                ? `${Math.round((100 * stats.settled) / stats.total)}% do previsto`
                : "Nada previsto ainda"}
            </span>
          }
        />
        <StatTile
          label={copy.open}
          cents={stats.open}
          tone={stats.overdue > 0 ? "var(--destructive)" : "var(--warning)"}
          icon="due"
          delay={0.12}
          footnote={
            stats.overdue > 0 ? (
              <button
                type="button"
                onClick={() => setStateFilter("overdue")}
                className="font-semibold text-destructive underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
              >
                {formatMoney(stats.overdue)} vencido — ver
              </button>
            ) : (
              <span className="text-admin-foreground/45">Nada vencido</span>
            )
          }
        />
      </div>

      {slices.length > 0 && (
        <div className="mt-4">
          <CategoryBreakdown
            slices={slices}
            tone={tone}
            title="Por linha de negócio"
            subtitle={
              direction === "in"
                ? "Onde a receita do mês foi gerada."
                : "Para onde o dinheiro do mês foi."
            }
          />
        </div>
      )}

      <div className="mt-4">
        {monthEmpty ? (
          <EmptyMonth monthKey={month.key} onCreate={openCreate} />
        ) : filtered.length === 0 ? (
          <NoResults
            direction={direction}
            filtersActive={filtersActive}
            onClear={() => {
              setSearch("");
              setStateFilter("all");
            }}
            onCreate={openCreate}
          />
        ) : (
          <div
            ref={listRef}
            className="overflow-hidden rounded-2xl border border-admin-border bg-admin-surface"
          >
            <div className="flex items-center justify-between gap-3 border-b border-admin-border bg-admin-muted/50 px-4 py-2.5">
              <span className="text-[10px] font-medium uppercase tracking-wide text-admin-foreground/50">
                {filtered.length} de {ofDirection.length} {copy.plural}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wide text-admin-foreground/50 tabular">
                {formatMoney(filtered.reduce((sum, entry) => sum + entry.amountCents, 0))}
              </span>
            </div>

            <AnimatePresence mode="popLayout">
              {filtered.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  today={today}
                  busy={busy === entry.id}
                  onEdit={() => openEdit(entry)}
                  onSettle={() =>
                    runOnEntry(entry.id, () => settleFinanceEntryAction(entry.id))
                  }
                  onReopen={() =>
                    runOnEntry(entry.id, () => reopenFinanceEntryAction(entry.id))
                  }
                  onDelete={() => setConfirmDelete(entry)}
                  onMethodChange={(method) =>
                    runOnEntry(entry.id, () =>
                      setFinancePaymentMethodAction(entry.id, method),
                    )
                  }
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <EntryFormPanel
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        entry={editing}
        initialDirection={direction}
        suggestedDate={suggestedDate(month.key, today)}
      />

      <Dialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Excluir lançamento"
        description="A exclusão é definitiva e muda o resultado do mês. O registro de quem excluiu fica na auditoria."
      >
        {confirmDelete && (
          <div className="space-y-4">
            <div className="rounded-xl border border-admin-border bg-admin-background p-3.5">
              <p className="text-sm font-medium text-admin-foreground">
                {confirmDelete.description}
              </p>
              <p className="mt-0.5 text-xs text-admin-foreground/55 tabular">
                {formatMoney(confirmDelete.amountCents)} ·{" "}
                {DIRECTION_COPY[confirmDelete.direction].tab.slice(0, -1)}
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-admin-foreground/60 transition-colors hover:bg-admin-muted hover:text-admin-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy === confirmDelete.id}
                onClick={() => {
                  const target = confirmDelete;
                  setConfirmDelete(null);
                  void runOnEntry(target.id, () => deleteFinanceEntryAction(target.id));
                }}
                className="rounded-xl bg-destructive px-5 py-2.5 text-sm font-semibold text-destructive-foreground transition-opacity hover:opacity-90 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
              >
                Excluir lançamento
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Estados vazios
// ---------------------------------------------------------------------------

/**
 * Mês sem nenhum lançamento. Os exemplos não são enfeite: um livro-caixa em
 * branco é justamente onde o admin menos sabe o que deveria estar ali.
 */
function EmptyMonth({ monthKey, onCreate }: { monthKey: string; onCreate: () => void }) {
  const examples = [
    {
      label: "Mensalidades da turma B1",
      tone: DIRECTION_TONE.in,
      hint: "receita recorrente",
    },
    {
      label: "Cachê dos professores",
      tone: DIRECTION_TONE.out,
      hint: "custo da entrega",
    },
    { label: "Aluguel da sala", tone: DIRECTION_TONE.out, hint: "despesa fixa" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-dashed border-admin-border bg-admin-surface px-6 py-12 text-center"
    >
      <p className="text-base font-semibold text-admin-foreground">
        Nenhum lançamento em {monthKeyTitle(monthKey).toLowerCase()}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-admin-foreground/55">
        Registre o que a escola tem a receber e a pagar nesta competência. O resultado do
        mês e o DRE do painel inicial se atualizam junto.
      </p>

      <div className="mx-auto mt-7 grid max-w-2xl gap-3 sm:grid-cols-3">
        {examples.map((example, index) => (
          <motion.div
            key={example.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.08, duration: 0.4 }}
            style={{
              boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${example.tone} 26%, transparent)`,
            }}
            className="rounded-xl bg-admin-background p-3 text-left"
          >
            <p className="text-[13px] font-semibold text-admin-foreground">
              {example.label}
            </p>
            <p className="mt-0.5 text-[11px] text-admin-foreground/45">{example.hint}</p>
          </motion.div>
        ))}
      </div>

      <button
        type="button"
        onClick={onCreate}
        className="mt-7 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-navy-800 to-navy-600 px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
      >
        <PlusIcon className="h-4 w-4" />
        Registrar o primeiro lançamento
      </button>
    </motion.div>
  );
}

function NoResults({
  direction,
  filtersActive,
  onClear,
  onCreate,
}: {
  direction: FinanceDirection;
  filtersActive: boolean;
  onClear: () => void;
  onCreate: () => void;
}) {
  const copy = DIRECTION_COPY[direction];

  return (
    <div className="rounded-2xl border border-dashed border-admin-border px-6 py-14 text-center">
      <p className="text-sm text-admin-foreground/60">
        {filtersActive
          ? `Nenhuma das ${copy.plural} corresponde ao filtro atual.`
          : `Nenhuma ${copy.plural.slice(0, -1)} registrada nesta competência.`}
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {filtersActive && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-gold-700 transition-colors hover:bg-gold-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
          >
            Limpar filtros
          </button>
        )}
        <button
          type="button"
          onClick={onCreate}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-admin-foreground/70 transition-colors hover:bg-admin-muted hover:text-admin-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
        >
          {copy.create}
        </button>
      </div>
    </div>
  );
}
