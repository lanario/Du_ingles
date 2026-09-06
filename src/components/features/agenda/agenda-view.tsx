"use client";

/**
 * A agenda da escola — a mesma tela para a coordenação, o professor e o
 * aluno.
 *
 * O que muda entre os três não é o componente: é o que o servidor coloca
 * dentro de `AgendaData`. O repositório recorta a leitura por papel (turma
 * do professor, matrícula do aluno, escola inteira para a coordenação) e
 * marca cada item com `canEdit`/`canDelete`. Aqui nada é recalculado — a
 * tela desenha o que veio, e as actions repetem a checagem no servidor.
 * Botão escondido nunca foi autorização.
 *
 * Quatro vistas, porque a mesma agenda responde a perguntas diferentes:
 * "como está o dia de hoje" (dia), "como está a semana da turma" (semana),
 * "quando é a prova" (mês) e "o que vem por aí" (lista — a vista que
 * funciona no celular). O filtro lateral corta por turma e por tipo, e a
 * escolha fica no navegador de quem usa: a coordenação que só acompanha duas
 * turmas não quer reconfigurar isso toda manhã.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { loadAgendaWindowAction } from "@/actions/shared/agenda";
import { SlideTabs } from "@/components/ui/slide-tabs";
import { ChevronRightIcon, PlusIcon } from "@/components/ui/icons";
import { LogoLoader } from "@/components/ui/logo-loader";
import { cn } from "@/lib/utils";
import type { AgendaData, AgendaItem } from "@/repositories/agenda";
import styles from "./agenda.module.css";
import { buildToneMap } from "./agenda-card";
import { AgendaDetail } from "./agenda-detail";
import { AgendaEventDialog, type AgendaEventDraft } from "./agenda-event-dialog";
import { useRevealOnScroll, useScrollProgress, useScrollToNow } from "./agenda-motion";
import {
  AGENDA_KIND_FILTERS,
  EVENT_TONES,
  GROUP_TONES,
  KIND_LABEL,
  addDaysISO,
  addMonthsISO,
  gridBounds,
  monthMatrix,
  nowMinutes,
  placeItems,
  rangeLabel,
  tint,
  todayISO,
  weekOf,
  type AgendaKindFilter,
  type AgendaViewMode,
  type PlacedItem,
} from "./agenda-utils";
import {
  DayView,
  EmptyGrid,
  ListView,
  MonthView,
  PIXELS_PER_MINUTE,
  WeekView,
  type DayColumn,
} from "./agenda-views";

const VIEW_TABS: { label: string; value: AgendaViewMode }[] = [
  { label: "Dia", value: "dia" },
  { label: "Semana", value: "semana" },
  { label: "Mês", value: "mes" },
  { label: "Lista", value: "lista" },
];

const STORAGE_KEY = "du:agenda:v1";
/** Quanto a janela carregada se estende além do que a vista precisa. */
const WINDOW_MARGIN_DAYS = 45;

interface StoredPreferences {
  view?: AgendaViewMode;
  hiddenGroups?: string[];
  hiddenKinds?: AgendaKindFilter[];
  showSchoolWide?: boolean;
}

export function AgendaView({
  initial,
  area,
}: {
  initial: AgendaData;
  /** De qual chrome a tela herda os tokens dos campos de formulário. */
  area: "admin" | "app";
}) {
  const reduceMotion = useReducedMotion();
  const today = todayISO();

  const [data, setData] = useState(initial);
  const [loadingWindow, setLoadingWindow] = useState(false);
  const [view, setView] = useState<AgendaViewMode>("semana");
  const [cursor, setCursor] = useState(today);
  const [direction, setDirection] = useState(1);

  // Guardar o que está ESCONDIDO (e não o que está visível) faz a turma nova
  // aparecer sozinha para quem já tinha filtro salvo — o contrário some com
  // ela sem que ninguém entenda por quê.
  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(new Set());
  const [hiddenKinds, setHiddenKinds] = useState<Set<AgendaKindFilter>>(new Set());
  const [showSchoolWide, setShowSchoolWide] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [selected, setSelected] = useState<PlacedItem | null>(null);
  const [draft, setDraft] = useState<AgendaEventDraft | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const requestedWindow = useRef<string | null>(null);

  // A página revalida (`router.refresh`) depois de cada escrita e devolve a
  // janela padrão; o efeito de janela abaixo recarrega se o cursor estiver
  // fora dela.
  useEffect(() => setData(initial), [initial]);

  // ------------------------------------------------------ preferências ----

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as StoredPreferences;
      if (saved.view) setView(saved.view);
      if (saved.hiddenGroups) setHiddenGroups(new Set(saved.hiddenGroups));
      if (saved.hiddenKinds) setHiddenKinds(new Set(saved.hiddenKinds));
      if (typeof saved.showSchoolWide === "boolean")
        setShowSchoolWide(saved.showSchoolWide);
    } catch {
      // Preferência corrompida ou storage bloqueado: a agenda abre no padrão.
    }
  }, []);

  useEffect(() => {
    try {
      const payload: StoredPreferences = {
        view,
        hiddenGroups: [...hiddenGroups],
        hiddenKinds: [...hiddenKinds],
        showSchoolWide,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Modo privado: a agenda funciona igual, só não lembra do filtro.
    }
  }, [view, hiddenGroups, hiddenKinds, showSchoolWide]);

  // ------------------------------------------------------------ janela ----

  /** Faixa de dias que a vista atual precisa ter em mãos. */
  const needed = useMemo(() => {
    if (view === "dia") return { from: cursor, to: cursor };
    if (view === "semana") {
      const week = weekOf(cursor);
      return { from: week[0] ?? cursor, to: week[6] ?? cursor };
    }
    if (view === "mes") {
      const weeks = monthMatrix(cursor);
      return { from: weeks[0]?.[0] ?? cursor, to: weeks[5]?.[6] ?? cursor };
    }
    return { from: cursor, to: addDaysISO(cursor, 60) };
  }, [view, cursor]);

  useEffect(() => {
    const loadedFrom = data.window.from.slice(0, 10);
    const loadedTo = data.window.to.slice(0, 10);
    if (needed.from >= loadedFrom && needed.to <= loadedTo) return;

    const from = `${addDaysISO(needed.from, -WINDOW_MARGIN_DAYS)}T00:00:00.000Z`;
    const to = `${addDaysISO(needed.to, WINDOW_MARGIN_DAYS)}T23:59:59.999Z`;
    const key = `${from}|${to}`;
    if (requestedWindow.current === key) return;
    requestedWindow.current = key;

    let cancelled = false;
    setLoadingWindow(true);
    loadAgendaWindowAction(from, to)
      .then((fresh) => {
        if (!cancelled && fresh) setData(fresh);
      })
      .finally(() => {
        if (!cancelled) setLoadingWindow(false);
      });

    return () => {
      cancelled = true;
    };
  }, [needed, data.window]);

  // ------------------------------------------------------------- dados ----

  const tones = useMemo(() => buildToneMap(data.groups), [data.groups]);
  const placed = useMemo(() => placeItems(data.items), [data.items]);

  const hasSchoolWide = useMemo(
    () => data.items.some((item) => item.groupId === null),
    [data.items],
  );

  const visible = useMemo(
    () =>
      placed.filter((entry) => {
        if (hiddenKinds.has(entry.filterKind)) return false;
        if (entry.item.groupId === null) return showSchoolWide;
        return !hiddenGroups.has(entry.item.groupId);
      }),
    [placed, hiddenKinds, hiddenGroups, showSchoolWide],
  );

  /** Quantos itens cada turma tem dentro do recorte da vista atual. */
  const countByGroup = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of placed) {
      if (entry.day < needed.from || entry.day > needed.to) continue;
      const key = entry.item.groupId ?? "escola";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [placed, needed]);

  const bounds = useMemo(() => {
    const scoped = visible.filter(
      (entry) => entry.day >= needed.from && entry.day <= needed.to,
    );
    return gridBounds(scoped);
  }, [visible, needed]);

  const dayColumns = useMemo<DayColumn[]>(() => {
    const columns: DayColumn[] = [];
    if (hasSchoolWide && showSchoolWide) {
      columns.push({
        id: null,
        name: "Escola",
        subtitle: "Sem turma",
        tone: EVENT_TONES.event,
      });
    }
    for (const group of data.groups) {
      if (hiddenGroups.has(group.id)) continue;
      columns.push({
        id: group.id,
        name: group.name,
        subtitle: `${group.level} · ${group.teacherName}`,
        tone: GROUP_TONES[group.colorIndex % GROUP_TONES.length] ?? GROUP_TONES[0],
      });
    }
    return columns;
  }, [data.groups, hiddenGroups, hasSchoolWide, showSchoolWide]);

  // ---------------------------------------------------------- movimento ---

  const gridDeps = [view, cursor, visible.length];
  useRevealOnScroll(scrollerRef, gridDeps);
  const progressRef = useScrollProgress(scrollerRef, gridDeps);

  /**
   * Só as vistas de grade rolam até "agora", e só quando hoje está na tela:
   * puxar o mês ou a lista para o meio esconderia justamente o começo deles.
   */
  const scrollToNowOffset =
    (view === "dia" || view === "semana") && today >= needed.from && today <= needed.to
      ? Math.max(0, (nowMinutes() - bounds.start) * PIXELS_PER_MINUTE)
      : null;
  useScrollToNow(scrollerRef, scrollToNowOffset, [view, cursor]);

  // ------------------------------------------------------------- ações ----

  const navigate = useCallback(
    (step: -1 | 1) => {
      setDirection(step);
      setCursor((current) => {
        if (view === "dia") return addDaysISO(current, step);
        if (view === "semana") return addDaysISO(current, step * 7);
        if (view === "mes") return addMonthsISO(current, step);
        return addDaysISO(current, step * 30);
      });
    },
    [view],
  );

  const openDay = useCallback((day: string) => {
    setCursor(day);
    setView("dia");
  }, []);

  // Clicar num horário vazio já traz o dia, a hora e — na vista de dia — a
  // turma da coluna. O professor que clicar na coluna da escola abre o
  // formulário sem turma e precisa escolher uma: é a mesma regra da action.
  const startCreate = useCallback(
    (info: { day: string; time: string; groupId: string | null }) => {
      setDraft({ day: info.day, time: info.time, groupId: info.groupId });
    },
    [],
  );

  const toggleGroup = (id: string) =>
    setHiddenGroups((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** Clique no nome isola a turma — e o segundo clique devolve todas. */
  const soloGroup = (id: string) =>
    setHiddenGroups((current) => {
      const others = data.groups.filter((group) => group.id !== id).map((g) => g.id);
      const isolated =
        current.size === others.length && others.every((g) => current.has(g));
      return isolated ? new Set() : new Set(others);
    });

  const toggleKind = (kind: AgendaKindFilter) =>
    setHiddenKinds((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });

  const canCreate = data.canCreateEvent;

  // ------------------------------------------------------------ render ----

  return (
    <div className="agenda-theme flex h-[calc(100dvh-8rem)] min-h-[520px] flex-col overflow-hidden rounded-2xl border border-[var(--agenda-border)] bg-[var(--agenda-surface)] text-[var(--agenda-fg)] shadow-[var(--shadow-card)]">
      {/* ------------------------------------------------- barra ------- */}
      <header className="relative shrink-0 border-b border-[var(--agenda-border)] px-3 py-2.5 sm:px-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1">
            <NavButton label="Anterior" onClick={() => navigate(-1)} flip />
            <button
              type="button"
              onClick={() => {
                setDirection(cursor > today ? -1 : 1);
                setCursor(today);
              }}
              className="h-9 rounded-lg border border-[var(--agenda-border)] px-3 text-sm font-medium transition-colors hover:bg-[var(--agenda-canvas)]"
            >
              Hoje
            </button>
            <NavButton label="Próximo" onClick={() => navigate(1)} />
          </div>

          <div className="min-w-0 flex-1">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={`${view}-${cursor}`}
                initial={reduceMotion ? false : { opacity: 0, y: direction * 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: direction * -8 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="truncate text-sm font-semibold capitalize sm:text-base"
              >
                {rangeLabel(view, cursor)}
              </motion.p>
            </AnimatePresence>
          </div>

          {loadingWindow && <LogoLoader size={18} label={null} />}

          <SlideTabs
            items={VIEW_TABS}
            value={view}
            onValueChange={(next) => setView(next as AgendaViewMode)}
            tone="surface"
            label="Vista da agenda"
            className="shrink-0"
          />

          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            className="h-9 rounded-lg border border-[var(--agenda-border)] px-3 text-sm font-medium transition-colors hover:bg-[var(--agenda-canvas)] lg:hidden"
          >
            Filtros
          </button>

          {canCreate && (
            <button
              type="button"
              onClick={() => startCreate({ day: cursor, time: "19:00", groupId: null })}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--agenda-primary)] px-3 text-sm font-semibold text-[var(--agenda-primary-fg)] transition-opacity hover:opacity-90"
            >
              <PlusIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Novo compromisso</span>
              <span className="sm:hidden">Novo</span>
            </button>
          )}
        </div>

        {/* Fio de progresso da rolagem da grade (GSAP). */}
        <span
          ref={progressRef}
          aria-hidden
          className="absolute inset-x-0 bottom-0 block h-px origin-left bg-[var(--agenda-accent)]"
        />
      </header>

      {/* ------------------------------------------------- corpo -------- */}
      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            "hidden w-60 shrink-0 flex-col border-r border-[var(--agenda-border)] lg:flex",
            styles.scroll,
          )}
        >
          <FilterPanel
            data={data}
            tones={tones}
            countByGroup={countByGroup}
            hiddenGroups={hiddenGroups}
            hiddenKinds={hiddenKinds}
            showSchoolWide={showSchoolWide}
            hasSchoolWide={hasSchoolWide}
            onToggleGroup={toggleGroup}
            onSoloGroup={soloGroup}
            onToggleKind={toggleKind}
            onToggleSchoolWide={() => setShowSchoolWide((current) => !current)}
          />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <AnimatePresence initial={false}>
            {filtersOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
                className="overflow-hidden border-b border-[var(--agenda-border)] lg:hidden"
              >
                <FilterPanel
                  data={data}
                  tones={tones}
                  countByGroup={countByGroup}
                  hiddenGroups={hiddenGroups}
                  hiddenKinds={hiddenKinds}
                  showSchoolWide={showSchoolWide}
                  hasSchoolWide={hasSchoolWide}
                  onToggleGroup={toggleGroup}
                  onSoloGroup={soloGroup}
                  onToggleKind={toggleKind}
                  onToggleSchoolWide={() => setShowSchoolWide((current) => !current)}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div
            ref={scrollerRef}
            className={cn("min-h-0 min-w-0 flex-1 overflow-auto", styles.scroll)}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={view}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                className="min-h-full"
              >
                {data.items.length === 0 ? (
                  <EmptyGrid label="Nada marcado nesta janela da agenda." />
                ) : view === "dia" ? (
                  <DayView
                    day={cursor}
                    columns={dayColumns}
                    bounds={bounds}
                    placed={visible}
                    tones={tones}
                    today={today}
                    onSelect={(item) => setSelected(find(visible, item))}
                    onCreateAt={canCreate ? startCreate : undefined}
                  />
                ) : view === "semana" ? (
                  <WeekView
                    anchor={cursor}
                    bounds={bounds}
                    placed={visible}
                    tones={tones}
                    today={today}
                    onSelect={(item) => setSelected(find(visible, item))}
                    onCreateAt={canCreate ? startCreate : undefined}
                    onPickDay={openDay}
                  />
                ) : view === "mes" ? (
                  <MonthView
                    anchor={cursor}
                    placed={visible}
                    tones={tones}
                    today={today}
                    onSelect={(item) => setSelected(find(visible, item))}
                    onPickDay={openDay}
                  />
                ) : (
                  <ListView
                    from={cursor}
                    placed={visible}
                    tones={tones}
                    today={today}
                    onSelect={(item) => setSelected(find(visible, item))}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <AgendaDetail
        placed={selected}
        tones={tones}
        tone={area}
        onClose={() => setSelected(null)}
        onEditEvent={(item) => {
          const entry = find(visible, item);
          setSelected(null);
          if (!entry) return;
          setDraft({
            item,
            day: entry.day,
            time: entry.startLabel,
            groupId: item.groupId,
          });
        }}
      />

      <AgendaEventDialog
        draft={draft}
        groups={data.groups}
        canCreateSchoolWide={data.canCreateSchoolWide}
        tone={area}
        onClose={() => setDraft(null)}
      />
    </div>
  );
}

function find(placed: PlacedItem[], item: AgendaItem): PlacedItem | null {
  return placed.find((entry) => entry.item.key === item.key) ?? null;
}

function NavButton({
  label,
  onClick,
  flip = false,
}: {
  label: string;
  onClick: () => void;
  flip?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--agenda-border)] text-[var(--agenda-muted-fg)] transition-colors hover:bg-[var(--agenda-canvas)] hover:text-[var(--agenda-fg)]"
    >
      <ChevronRightIcon className={cn("h-4 w-4", flip && "rotate-180")} />
    </button>
  );
}

// ------------------------------------------------------------- filtros -----

function FilterPanel({
  data,
  tones,
  countByGroup,
  hiddenGroups,
  hiddenKinds,
  showSchoolWide,
  hasSchoolWide,
  onToggleGroup,
  onSoloGroup,
  onToggleKind,
  onToggleSchoolWide,
}: {
  data: AgendaData;
  tones: Map<string, string>;
  countByGroup: Map<string, number>;
  hiddenGroups: Set<string>;
  hiddenKinds: Set<AgendaKindFilter>;
  showSchoolWide: boolean;
  hasSchoolWide: boolean;
  onToggleGroup: (id: string) => void;
  onSoloGroup: (id: string) => void;
  onToggleKind: (kind: AgendaKindFilter) => void;
  onToggleSchoolWide: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <section className="border-b border-[var(--agenda-border)] px-3 py-3">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--agenda-muted-fg)]">
          Turmas
        </h2>

        {hasSchoolWide && (
          <FilterRow
            tone={EVENT_TONES.event}
            active={showSchoolWide}
            title="Escola inteira"
            subtitle="Compromissos sem turma"
            count={countByGroup.get("escola") ?? 0}
            onToggle={onToggleSchoolWide}
          />
        )}

        {data.groups.length === 0 && (
          <p className="text-xs text-[var(--agenda-muted-fg)]">
            Nenhuma turma para filtrar.
          </p>
        )}

        {data.groups.map((group) => (
          <FilterRow
            key={group.id}
            tone={tones.get(group.id) ?? GROUP_TONES[0]}
            active={!hiddenGroups.has(group.id)}
            title={group.name}
            subtitle={`${group.level} · ${group.teacherName}`}
            count={countByGroup.get(group.id) ?? 0}
            onToggle={() => onToggleGroup(group.id)}
            onSolo={() => onSoloGroup(group.id)}
          />
        ))}
      </section>

      <section className="px-3 py-3">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--agenda-muted-fg)]">
          Tipos
        </h2>
        <ul className="space-y-0.5">
          {AGENDA_KIND_FILTERS.map((kind) => {
            const active = !hiddenKinds.has(kind);
            const tone =
              kind === "session" || kind === "preview"
                ? "var(--navy-600)"
                : EVENT_TONES[kind];
            return (
              <li key={kind}>
                <button
                  type="button"
                  onClick={() => onToggleKind(kind)}
                  aria-pressed={active}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                    "hover:bg-[var(--agenda-canvas)]",
                    active ? "text-[var(--agenda-fg)]" : "text-[var(--agenda-muted-fg)]",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "h-2.5 w-2.5 shrink-0 rounded-full border-2",
                      kind === "preview" && "border-dashed",
                    )}
                    style={{
                      borderColor: tone,
                      backgroundColor:
                        active && kind !== "preview" ? tone : "transparent",
                    }}
                  />
                  <span className="truncate">{KIND_LABEL[kind]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="mt-auto border-t border-[var(--agenda-border)] px-3 py-3 text-[11px] leading-relaxed text-[var(--agenda-muted-fg)]">
        Linha pontilhada é <strong className="font-semibold">prévia da grade</strong>: a
        aula que a turma tende a ter nessa data, ainda não marcada.
      </p>
    </div>
  );
}

function FilterRow({
  tone,
  active,
  title,
  subtitle,
  count,
  onToggle,
  onSolo,
}: {
  tone: string;
  active: boolean;
  title: string;
  subtitle: string;
  count: number;
  onToggle: () => void;
  onSolo?: () => void;
}) {
  return (
    <div className="group flex items-center gap-2.5 rounded-lg px-1 py-1.5 transition-colors hover:bg-[var(--agenda-canvas)]">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={active}
        aria-label={`Mostrar ${title}`}
        className="grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border-2 transition-colors"
        style={{
          borderColor: tone,
          backgroundColor: active ? tone : "transparent",
        }}
      >
        {active && (
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden>
            <path
              d="m2.5 6.2 2.3 2.3 4.7-5"
              fill="none"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      <button
        type="button"
        onClick={onSolo}
        disabled={!onSolo}
        title={onSolo ? "Ver apenas esta turma" : undefined}
        className="min-w-0 flex-1 text-left disabled:cursor-default"
      >
        <span
          className={cn(
            "block truncate text-sm font-medium",
            active ? "text-[var(--agenda-fg)]" : "text-[var(--agenda-muted-fg)]",
          )}
        >
          {title}
        </span>
        <span className="block truncate text-[11px] text-[var(--agenda-muted-fg)]">
          {subtitle}
        </span>
      </button>

      <span
        className="shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums"
        style={{ backgroundColor: tint(tone, 14), color: tone }}
      >
        {count}
      </span>
    </div>
  );
}
