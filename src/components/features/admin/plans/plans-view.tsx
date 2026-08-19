"use client";

/**
 * Área de planos de alunos: estado do Connect no topo, indicadores de receita,
 * barra de ferramentas fixa, e as duas visualizações (cartões e lista) — o
 * mesmo modelo já usado em Usuários, Alunos e Turmas, com preço e assinantes
 * no lugar de lotação.
 *
 * Busca e filtros são locais: a página entrega o catálogo inteiro de uma vez
 * (uma escola tem dezenas de planos, não milhares), então filtrar em memória
 * é imediato e não passa termo pela URL.
 *
 * Divisão das duas libs de animação, como no resto do painel: Framer Motion
 * cuida do ciclo de vida do React (entrada dos cartões, layout, abas, hover) e
 * GSAP/ScrollTrigger cuida do que depende da rolagem (barra que gruda no topo,
 * fio de progresso da lista, count-up dos indicadores).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  setPlanActiveAction,
  syncPlanAction,
} from "@/actions/admin/student-plans";
import { CountUp } from "@/components/features/admin/dashboard/primitives";
import { useListProgress, useStickyBar } from "@/components/motion/list-motion";
import { useNarrowScreen, useViewMode } from "@/components/motion/use-view-mode";
import { Select } from "@/components/ui/select";
import {
  CloseIcon,
  GridIcon,
  PlusIcon,
  RowsIcon,
  SearchIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { ConnectCard } from "./connect-card";
import { PlanCard } from "./plan-card";
import { PlanDetailPanel } from "./plan-detail-panel";
import { PlanFormPanel } from "./plan-form-panel";
import { LIST_GRID, PlanListItem } from "./plan-list-item";
import {
  ACCENT_TONE,
  SORT_LABEL,
  STATUS_LABEL,
  formatMoney,
  matchesStatus,
  planMatches,
  sortPlans,
  type SortMode,
  type StatusFilter,
  type StudentPlan,
} from "./plans-utils";
import type { ConnectAccount } from "@/repositories/stripe-connect";
import type { SubscriptionSummary } from "@/repositories/student-subscriptions";

const STATUS_TABS: StatusFilter[] = ["all", "active", "draft", "archived"];
const SORT_MODES: SortMode[] = ["order", "price", "subscribers", "name"];
const VIEW_MODE_KEY = "du:planos:modo";

interface PlansViewProps {
  plans: StudentPlan[];
  account: ConnectAccount | null;
  summary: SubscriptionSummary;
  stripeConfigured: boolean;
  stripeLiveMode: boolean;
}

export function PlansView({
  plans,
  account,
  summary,
  stripeConfigured,
  stripeLiveMode,
}: PlansViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortMode>("order");

  const [viewMode, setViewMode] = useViewMode(VIEW_MODE_KEY);
  const narrow = useNarrowScreen();
  const mode = narrow ? "cards" : viewMode;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StudentPlan | null>(null);
  const [detail, setDetail] = useState<StudentPlan | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { sentinelRef, barRef } = useStickyBar<HTMLDivElement>();
  const lineRef = useListProgress(listRef);

  const canPublish = Boolean(account?.chargesEnabled);

  // Volta do onboarding da Stripe (`?connect=retorno`): a conta pode ter sido
  // liberada segundos atrás, então o servidor precisa reler antes de a tela
  // afirmar qualquer coisa.
  const connectParam = searchParams.get("connect");
  useEffect(() => {
    if (!connectParam) return;
    router.replace("/admin/planos-de-alunos");
    router.refresh();
  }, [connectParam, router]);

  // Os painéis seguem a lista: depois de salvar ou arquivar, o plano aberto
  // tem que refletir o dado novo, não o snapshot de quando abriu.
  useEffect(() => {
    setDetail((current) => (current ? (plans.find((p) => p.id === current.id) ?? null) : null));
    setEditing((current) => (current ? (plans.find((p) => p.id === current.id) ?? null) : null));
  }, [plans]);

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

  const statusCounts = useMemo(() => {
    const counts = {} as Record<StatusFilter, number>;
    for (const tab of STATUS_TABS) {
      counts[tab] = plans.filter((plan) => matchesStatus(plan, tab)).length;
    }
    return counts;
  }, [plans]);

  const filtered = useMemo(() => {
    const result = plans.filter(
      (plan) => matchesStatus(plan, status) && planMatches(plan, search),
    );
    return sortPlans(result, sort);
  }, [plans, status, search, sort]);

  function openDetail(plan: StudentPlan) {
    setDetail(plan);
    setDetailOpen(true);
  }

  function openEdit(plan: StudentPlan) {
    setDetailOpen(false);
    setEditing(plan);
    setFormOpen(true);
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  async function runOnPlan(planId: string, work: () => Promise<{ success: boolean; error?: { message: string } }>) {
    setError(null);
    setBusy(planId);
    try {
      const result = await work();
      if (!result.success) setError(result.error?.message ?? "Falha na operação.");
      else router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const noPlansAtAll = plans.length === 0;
  const filtersActive = search.trim() !== "" || status !== "all";

  return (
    <div className="pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-admin-foreground">Planos de alunos</h1>
          <p className="mt-2 max-w-xl text-sm text-admin-foreground/60">
            Monte os pacotes que a escola vende. Cada plano publicado vira um produto na
            Stripe, com link de pagamento pronto para enviar — e aparece na vitrine do
            aluno.
          </p>
        </div>

        <dl className="flex flex-wrap gap-2">
          <Indicator label="Planos" value={plans.length} />
          <Indicator label="Publicados" value={statusCounts.active} tone="var(--success)" />
          <Indicator
            label="Assinantes"
            value={summary.activeCount}
            tone="var(--navy-500)"
          />
          <Indicator
            label="MRR"
            value={summary.mrrCents / 100}
            tone="var(--gold-600)"
            prefix="R$ "
            decimals={2}
            title={`Receita recorrente mensal: ${formatMoney(summary.mrrCents)}`}
          />
        </dl>
      </div>

      <div className="mt-5">
        <ConnectCard
          account={account}
          configured={stripeConfigured}
          liveMode={stripeLiveMode}
        />
      </div>

      {(summary.pastDueCount > 0 || summary.trialingCount > 0) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {summary.trialingCount > 0 && (
            <MiniStat
              tone="var(--navy-500)"
              label={`${summary.trialingCount} em período de teste`}
            />
          )}
          {summary.pastDueCount > 0 && (
            <MiniStat
              tone="var(--destructive)"
              label={`${summary.pastDueCount} com pagamento em atraso`}
            />
          )}
        </div>
      )}

      <div ref={sentinelRef} aria-hidden className="mt-6 h-px" />

      <div
        ref={barRef}
        data-stuck="false"
        className={cn(
          "sticky top-16 z-30 -mx-6 mb-4 flex flex-wrap items-center gap-2 border-b border-transparent px-6 py-3 sm:mb-5 sm:gap-3",
          "bg-[color-mix(in_srgb,var(--admin-background)_88%,transparent)] backdrop-blur-md transition-[border-color,box-shadow] duration-300",
          "data-[stuck=true]:border-admin-border data-[stuck=true]:shadow-[0_18px_30px_-28px_rgba(11,26,51,0.35)]",
        )}
      >
        <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px]">
          <span
            ref={lineRef}
            className="block h-full w-full origin-left bg-gradient-to-r from-navy-700 to-gold-500"
          />
        </span>

        <div
          role="group"
          aria-label="Filtrar por status"
          className="flex max-w-full flex-wrap items-center gap-1 rounded-xl border border-admin-border bg-admin-surface p-1"
        >
          {STATUS_TABS.map((tab) => {
            const active = status === tab;
            return (
              <button
                key={tab}
                type="button"
                aria-pressed={active}
                onClick={() => setStatus(tab)}
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
                    layoutId="du-planos-tab"
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
                  {STATUS_LABEL[tab]}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[10px] font-semibold tabular",
                      active
                        ? "bg-gold-100 text-gold-700"
                        : "bg-admin-muted text-admin-foreground/50",
                    )}
                  >
                    {statusCounts[tab]}
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
            aria-label="Buscar plano"
            placeholder="Buscar por nome, benefício, nível ou periodicidade..."
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

        <div className="hidden md:block">
          <Select
            tone="admin"
            value={sort}
            onChange={(next) => setSort(next as SortMode)}
            aria-label="Ordenar planos"
            className="h-[42px] bg-admin-surface"
          >
            {SORT_MODES.map((item) => (
              <option key={item} value={item}>
                {SORT_LABEL[item]}
              </option>
            ))}
          </Select>
        </div>

        <div className="hidden items-center gap-1 rounded-xl border border-admin-border bg-admin-surface p-1 sm:flex">
          <ViewToggle
            active={mode === "cards"}
            onClick={() => setViewMode("cards")}
            label="Ver em cartões"
            icon={<GridIcon className="h-4 w-4" />}
          />
          <ViewToggle
            active={mode === "list"}
            onClick={() => setViewMode("list")}
            label="Ver em lista"
            icon={<RowsIcon className="h-4 w-4" />}
          />
        </div>

        <button
          type="button"
          onClick={openCreate}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity",
            "bg-gradient-to-r from-navy-800 to-navy-600 text-white",
            "hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
          )}
        >
          <PlusIcon className="h-4 w-4" />
          Novo plano
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

      {noPlansAtAll ? (
        <EmptyState onCreate={openCreate} />
      ) : filtered.length === 0 ? (
        <NoResults
          onClear={() => {
            setSearch("");
            setStatus("all");
          }}
          filtersActive={filtersActive}
        />
      ) : mode === "cards" ? (
        <div
          ref={listRef}
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                busy={busy === plan.id}
                onOpen={() => openDetail(plan)}
                onEdit={() => openEdit(plan)}
                onSync={() => runOnPlan(plan.id, () => syncPlanAction(plan.id))}
                onToggleActive={() =>
                  runOnPlan(plan.id, () => setPlanActiveAction(plan.id, !plan.isActive))
                }
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div
          ref={listRef}
          className="overflow-hidden rounded-2xl border border-admin-border bg-admin-surface"
        >
          <div
            className={cn(
              LIST_GRID,
              "border-b border-admin-border bg-admin-muted/50 px-4 py-2.5 text-[10px] font-medium uppercase tracking-wide text-admin-foreground/50",
            )}
          >
            <span>Plano</span>
            <span>Preço</span>
            <span>Ciclo</span>
            <span>Assinantes</span>
            <span>Stripe</span>
            <span>Vitrine</span>
            <span className="sr-only">Ações</span>
          </div>

          <AnimatePresence mode="popLayout">
            {filtered.map((plan) => (
              <PlanListItem
                key={plan.id}
                plan={plan}
                busy={busy === plan.id}
                onOpen={() => openDetail(plan)}
                onEdit={() => openEdit(plan)}
                onSync={() => runOnPlan(plan.id, () => syncPlanAction(plan.id))}
                onToggleActive={() =>
                  runOnPlan(plan.id, () => setPlanActiveAction(plan.id, !plan.isActive))
                }
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <PlanFormPanel
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        plan={editing}
        canPublish={canPublish}
      />

      <PlanDetailPanel
        plan={detail}
        open={detailOpen}
        busy={busy === detail?.id}
        onClose={() => setDetailOpen(false)}
        onEdit={() => detail && openEdit(detail)}
        onSync={() => detail && runOnPlan(detail.id, () => syncPlanAction(detail.id))}
        onToggleActive={() =>
          detail &&
          runOnPlan(detail.id, () => setPlanActiveAction(detail.id, !detail.isActive))
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Peças locais
// ---------------------------------------------------------------------------

function Indicator({
  label,
  value,
  tone,
  prefix,
  decimals = 0,
  title,
}: {
  label: string;
  value: number;
  tone?: string;
  prefix?: string;
  decimals?: number;
  title?: string;
}) {
  return (
    <div
      title={title}
      className="rounded-xl border border-admin-border bg-admin-surface px-3.5 py-2"
    >
      <dt className="text-[10px] font-medium uppercase tracking-wide text-admin-foreground/45">
        {label}
      </dt>
      <dd
        className="text-lg font-semibold leading-tight"
        style={{ color: tone ?? "var(--admin-foreground)" }}
      >
        <CountUp value={value} prefix={prefix} decimals={decimals} />
      </dd>
    </div>
  );
}

function MiniStat({ tone, label }: { tone: string; label: string }) {
  return (
    <span
      style={{ color: tone, backgroundColor: `color-mix(in srgb, ${tone} 9%, #ffffff)` }}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium"
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tone }} />
      {label}
    </span>
  );
}

function ViewToggle({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={cn(
        "rounded-lg p-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
        active
          ? "bg-admin-muted text-admin-foreground"
          : "text-admin-foreground/40 hover:text-admin-foreground",
      )}
    >
      {icon}
    </button>
  );
}

/**
 * Estado vazio com três sugestões prontas. Um catálogo em branco é a hora em
 * que o admin menos sabe por onde começar — os exemplos são o roteiro, não
 * enfeite.
 */
function EmptyState({ onCreate }: { onCreate: () => void }) {
  const examples = [
    { name: "Essencial", price: "R$ 249/mês", detail: "4 aulas em grupo", accent: "navy" as const },
    { name: "Premium", price: "R$ 449/mês", detail: "8 aulas + conversação", accent: "gold" as const },
    { name: "Intensivo", price: "R$ 799/mês", detail: "aulas individuais", accent: "emerald" as const },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-dashed border-admin-border bg-admin-surface px-6 py-12 text-center"
    >
      <p className="text-base font-semibold text-admin-foreground">
        Nenhum plano criado ainda
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-admin-foreground/55">
        Um plano define o que o aluno compra e quanto paga. Ao salvar, ele é publicado
        na Stripe com link de pagamento próprio.
      </p>

      <div className="mx-auto mt-7 grid max-w-2xl gap-3 sm:grid-cols-3">
        {examples.map((example, index) => (
          <motion.div
            key={example.name}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.08, duration: 0.4 }}
            style={{ boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${ACCENT_TONE[example.accent]} 28%, transparent)` }}
            className="rounded-xl bg-admin-background p-3 text-left"
          >
            <p className="text-[13px] font-semibold text-admin-foreground">{example.name}</p>
            <p className="mt-0.5 text-[12px] tabular text-admin-foreground/60">
              {example.price}
            </p>
            <p className="mt-1 text-[11px] text-admin-foreground/45">{example.detail}</p>
          </motion.div>
        ))}
      </div>

      <button
        type="button"
        onClick={onCreate}
        className="mt-7 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-navy-800 to-navy-600 px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
      >
        <PlusIcon className="h-4 w-4" />
        Criar o primeiro plano
      </button>
    </motion.div>
  );
}

function NoResults({
  onClear,
  filtersActive,
}: {
  onClear: () => void;
  filtersActive: boolean;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-admin-border px-6 py-14 text-center">
      <p className="text-sm text-admin-foreground/60">
        Nenhum plano corresponde ao que você procurou.
      </p>
      {filtersActive && (
        <button
          type="button"
          onClick={onClear}
          className="mt-3 rounded-lg px-3 py-1.5 text-sm font-medium text-gold-700 transition-colors hover:bg-gold-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
