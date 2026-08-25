"use client";

/**
 * Área de turmas: indicadores no topo, barra de ferramentas fixa, filtros por
 * professor e nível, e as duas visualizações (cartões e lista) — o mesmo
 * modelo já usado em Usuários e Alunos, com lotação no lugar de status de
 * pessoa.
 *
 * Busca e filtros são locais: a página entrega todas as turmas da organização
 * de uma vez, então filtrar em memória é imediato e não passa termo pela URL.
 *
 * Divisão das duas libs de animação, como no resto do painel: Framer Motion
 * cuida do ciclo de vida do React (entrada dos cartões, layout, abas, hover) e
 * GSAP/ScrollTrigger cuida do que depende da rolagem (barra que gruda no topo,
 * fio de progresso da lista, count-up dos indicadores).
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { setGroupActiveAction } from "@/actions/admin/groups";
import { CountUp } from "@/components/features/admin/dashboard/primitives";
import { useArea } from "@/components/features/admin/area-context";
import { useListProgress, useStickyBar } from "@/components/motion/list-motion";
import { useNarrowScreen, useViewMode } from "@/components/motion/use-view-mode";
import { Select } from "@/components/ui/select";
import {
  CalendarIcon,
  CloseIcon,
  GridIcon,
  GroupsIcon,
  PlusIcon,
  RowsIcon,
  SearchIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { CreateGroupPanel } from "./create-group-panel";
import { EditGroupPanel } from "./edit-group-panel";
import { GroupCard } from "./group-card";
import { GroupDetailPanel } from "./group-detail-panel";
import { LIST_GRID, GroupListItem } from "./group-list-item";
import { GroupsFilterRail } from "./groups-filter-rail";
import { GroupsWeekAgenda } from "./groups-week-agenda";
import {
  CEFR_LEVELS_ORDER,
  SORT_LABEL,
  groupMatches,
  seatsLeft,
  sortGroups,
  teacherBuckets,
  type Group,
  type SortMode,
  type StatusFilter,
  type TeacherFilter,
} from "./groups-utils";
import type { Course } from "@/repositories/courses";
import type { EnrollmentListItem } from "@/repositories/enrollments";
import type { UserListItem } from "@/repositories/users";
import type { CefrLevel } from "@/types/domain";

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "active", label: "Ativas" },
  { id: "inactive", label: "Arquivadas" },
];

const SORT_MODES: SortMode[] = ["name", "occupancy", "students"];

const VIEW_MODE_KEY = "du:turmas:modo";

type PageTab = "turmas" | "agenda";

const PAGE_TABS: { id: PageTab; label: string; icon: typeof GroupsIcon }[] = [
  { id: "turmas", label: "Turmas", icon: GroupsIcon },
  { id: "agenda", label: "Agenda", icon: CalendarIcon },
];

interface TurmasViewProps {
  groups: Group[];
  courses: Course[];
  teachers: UserListItem[];
  rosters: Record<string, EnrollmentListItem[]>;
  openCreate?: boolean;
}

export function TurmasView({
  groups,
  courses,
  teachers,
  rosters,
  openCreate = false,
}: TurmasViewProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  // O professor opera as próprias turmas; criar turma nova (e escolher quem
  // responde por ela) continua sendo coordenação.
  const { base, canManageGroups } = useArea();

  const [page, setPage] = useState<PageTab>("turmas");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [teacherFilter, setTeacherFilter] = useState<TeacherFilter>({ type: "all" });
  const [levelFilter, setLevelFilter] = useState<CefrLevel | "all">("all");
  const [sort, setSort] = useState<SortMode>("name");

  const [viewMode, setViewMode] = useViewMode(VIEW_MODE_KEY);
  const narrow = useNarrowScreen();
  const mode = narrow ? "cards" : viewMode;

  const [createOpen, setCreateOpen] = useState(openCreate);
  const [detail, setDetail] = useState<Group | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { sentinelRef, barRef } = useStickyBar<HTMLDivElement>();
  const lineRef = useListProgress(listRef);

  // `?nova=1` (vindo de /admin/turmas/novo, mantida por compatibilidade) só
  // deve abrir o painel uma vez — sem isto, um F5 reabriria sozinho.
  useEffect(() => {
    setCreateOpen(openCreate);
  }, [openCreate]);

  function closeCreate() {
    setCreateOpen(false);
    if (openCreate) router.replace(`${base}/turmas` as Route);
  }

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

  // O painel de detalhe segue a lista: depois de salvar ou arquivar, a turma
  // aberta tem que refletir o dado novo, não o snapshot de quando abriu.
  useEffect(() => {
    setDetail((current) => (current ? (groups.find((g) => g.id === current.id) ?? null) : null));
    setEditing((current) => (current ? (groups.find((g) => g.id === current.id) ?? null) : null));
  }, [groups]);

  const totals = useMemo(() => {
    const active = groups.filter((group) => group.isActive);
    return {
      total: groups.length,
      active: active.length,
      students: groups.reduce((sum, group) => sum + group.enrolledCount, 0),
      seats: active.reduce((sum, group) => sum + seatsLeft(group), 0),
    };
  }, [groups]);

  /** O professor escolhido delimita tudo o que vem depois — abas e níveis contam dentro dele. */
  const inTeacher = useMemo(
    () =>
      teacherFilter.type === "teacher"
        ? groups.filter((group) => group.teacherId === teacherFilter.id)
        : groups,
    [groups, teacherFilter],
  );

  const statusCounts: Record<StatusFilter, number> = {
    all: inTeacher.length,
    active: inTeacher.filter((group) => group.isActive).length,
    inactive: inTeacher.filter((group) => !group.isActive).length,
  };

  const levelBuckets = useMemo(() => {
    const counts = new Map<CefrLevel, number>();
    for (const group of inTeacher) counts.set(group.level, (counts.get(group.level) ?? 0) + 1);
    return CEFR_LEVELS_ORDER.filter((level) => counts.has(level)).map((level) => ({
      level,
      count: counts.get(level) ?? 0,
    }));
  }, [inTeacher]);

  const filtered = useMemo(() => {
    const result = inTeacher.filter((group) => {
      if (status === "active" && !group.isActive) return false;
      if (status === "inactive" && group.isActive) return false;
      if (levelFilter !== "all" && group.level !== levelFilter) return false;
      return groupMatches(group, search);
    });
    return sortGroups(result, sort);
  }, [inTeacher, status, levelFilter, search, sort]);

  function openDetail(group: Group) {
    setDetail(group);
    setDetailOpen(true);
  }

  function openEdit(group: Group) {
    setDetailOpen(false);
    setEditing(group);
  }

  async function toggleActive(group: Group) {
    setError(null);
    setBusy(group.id);
    try {
      const result = await setGroupActiveAction(group.id, !group.isActive);
      if (!result.success) setError(result.error.message);
      else router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const noGroupsAtAll = groups.length === 0;
  const filtersActive =
    search.trim() !== "" ||
    status !== "all" ||
    levelFilter !== "all" ||
    teacherFilter.type !== "all";

  function clearFilters() {
    setSearch("");
    setStatus("all");
    setLevelFilter("all");
    setTeacherFilter({ type: "all" });
  }

  return (
    <div className="pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-admin-foreground">Turmas</h1>
          <p className="mt-2 max-w-xl text-sm text-admin-foreground/60">
            Turmas ativas, professores responsáveis, grade semanal e ocupação.
          </p>
        </div>

        <dl className="flex flex-wrap gap-2">
          <Indicator label="Turmas" value={totals.total} />
          <Indicator label="Ativas" value={totals.active} tone="var(--success)" />
          <Indicator label="Matriculados" value={totals.students} tone="var(--navy-500)" />
          <Indicator label="Vagas livres" value={totals.seats} tone="var(--gold-600)" />
        </dl>
      </div>

      <div
        role="tablist"
        aria-label="Modo de exibição"
        className="mt-5 inline-flex items-center gap-1 rounded-xl border border-admin-border bg-admin-surface p-1"
      >
        {PAGE_TABS.map((tab) => {
          const active = page === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setPage(tab.id)}
              className={cn(
                "relative flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
                active
                  ? "text-admin-foreground"
                  : "text-admin-foreground/50 hover:text-admin-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="du-turmas-page-tab"
                  aria-hidden
                  className="absolute inset-0 rounded-lg bg-admin-muted shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--gold-500)_30%,transparent)]"
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 480, damping: 38 }
                  }
                />
              )}
              <tab.icon className="relative h-4 w-4" />
              <span className="relative">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div ref={sentinelRef} aria-hidden className="mt-6 h-px" />

      <div
        ref={barRef}
        data-stuck="false"
        className={cn(
          "sticky top-0 z-30 -mx-4 mb-4 md:top-16 md:-mx-6 flex flex-wrap items-center gap-2 border-b border-transparent px-4 py-3 md:px-6 sm:mb-5 sm:gap-3",
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
          {STATUS_TABS.map((item) => {
            const active = status === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => setStatus(item.id)}
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
                    layoutId="du-turmas-tab"
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
                  {item.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[10px] font-semibold tabular",
                      active
                        ? "bg-gold-100 text-gold-700"
                        : "bg-admin-muted text-admin-foreground/50",
                    )}
                  >
                    {statusCounts[item.id]}
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
            aria-label="Buscar turma"
            placeholder="Buscar por turma, professor, curso ou dia da semana..."
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

        {page === "turmas" && (
          <>
            <div className="hidden md:block">
              <Select
                tone="admin"
                value={sort}
                onChange={(next) => setSort(next as SortMode)}
                aria-label="Ordenar turmas"
                className="h-[42px] bg-admin-surface"
              >
                {SORT_MODES.map((item) => (
                  <option key={item} value={item}>
                    {SORT_LABEL[item]}
                  </option>
                ))}
              </Select>
            </div>

            <div
              role="group"
              aria-label="Modo de visualização"
              className="hidden items-center gap-1 rounded-xl border border-admin-border bg-admin-surface p-1 sm:flex"
            >
              <ViewModeButton
                active={mode === "cards"}
                label="Ver em cartões"
                onClick={() => setViewMode("cards")}
              >
                <GridIcon className="relative h-4 w-4" />
              </ViewModeButton>
              <ViewModeButton
                active={mode === "list"}
                label="Ver em lista"
                onClick={() => setViewMode("list")}
              >
                <RowsIcon className="relative h-4 w-4" />
              </ViewModeButton>
            </div>
          </>
        )}

        {canManageGroups && (
          <motion.button
            type="button"
            onClick={() => setCreateOpen(true)}
            whileHover={reduceMotion ? undefined : { scale: 1.03 }}
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold-600 to-gold-400 px-3 py-2.5 text-sm font-semibold text-admin-foreground shadow-[0_8px_24px_-12px_rgba(201,162,39,0.75)] transition-opacity hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 sm:px-4"
          >
            <PlusIcon className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Nova turma</span>
          </motion.button>
        )}
      </div>

      <GroupsFilterRail
        teachers={teacherBuckets(groups)}
        teacherFilter={teacherFilter}
        onTeacherChange={setTeacherFilter}
        total={groups.length}
        levels={levelBuckets}
        levelFilter={levelFilter}
        onLevelChange={setLevelFilter}
      />

      <AnimatePresence>
        {error && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mb-5 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div ref={listRef}>
        {filtered.length === 0 ? (
          <EmptyState
            title={
              noGroupsAtAll
                ? canManageGroups
                  ? "Nenhuma turma criada ainda"
                  : "Você ainda não tem turmas"
                : "Nada encontrado"
            }
            description={
              noGroupsAtAll
                ? canManageGroups
                  ? "Crie a primeira turma para começar a matricular alunos e gerar as sessões da agenda."
                  : "Assim que a coordenação atribuir uma turma a você, ela aparece aqui."
                : "Ajuste a busca ou troque os filtros de professor, nível e status."
            }
            action={
              noGroupsAtAll && canManageGroups ? (
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold-600 to-gold-400 px-4 py-2.5 text-sm font-semibold text-admin-foreground shadow-[0_8px_24px_-12px_rgba(201,162,39,0.75)] transition-opacity hover:opacity-95"
                >
                  <PlusIcon className="h-4 w-4" />
                  Nova turma
                </button>
              ) : filtersActive ? (
                <SecondaryButton onClick={clearFilters}>Limpar filtros</SecondaryButton>
              ) : null
            }
          />
        ) : page === "agenda" ? (
          <GroupsWeekAgenda groups={filtered} rosters={rosters} onEdit={openEdit} />
        ) : mode === "cards" ? (
          <motion.div layout className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <AnimatePresence mode="popLayout" initial={false}>
              {filtered.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  busy={busy === group.id}
                  onOpen={() => openDetail(group)}
                  onEdit={() => openEdit(group)}
                  onToggleActive={() => toggleActive(group)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <div className="rounded-2xl border border-admin-border">
            <div
              className={cn(
                LIST_GRID,
                "rounded-t-2xl border-b border-admin-border bg-admin-surface px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-admin-foreground/50",
              )}
            >
              <span>Turma</span>
              <span>Professor</span>
              <span>Nível</span>
              <span>Ocupação</span>
              <span>Horários</span>
              <span>Status</span>
              <span className="text-right">Ações</span>
            </div>
            <motion.div layout className="[&>*:last-child]:rounded-b-2xl">
              <AnimatePresence mode="popLayout" initial={false}>
                {filtered.map((group) => (
                  <GroupListItem
                    key={group.id}
                    group={group}
                    busy={busy === group.id}
                    onOpen={() => openDetail(group)}
                    onEdit={() => openEdit(group)}
                    onToggleActive={() => toggleActive(group)}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <p className="mt-4 text-xs text-admin-foreground/50">
          Exibindo {filtered.length} de {totals.total}{" "}
          {totals.total === 1 ? "turma" : "turmas"}.
        </p>
      )}

      <GroupDetailPanel
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        group={detail}
        busy={detail !== null && busy === detail.id}
        onEdit={() => detail && openEdit(detail)}
        onToggleActive={() => detail && toggleActive(detail)}
      />

      <EditGroupPanel
        open={editing !== null}
        onClose={() => setEditing(null)}
        group={editing}
        courses={courses}
        teachers={teachers}
      />

      {canManageGroups && (
        <CreateGroupPanel
          open={createOpen}
          onClose={closeCreate}
          courses={courses}
          teachers={teachers}
        />
      )}
    </div>
  );
}

function Indicator({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-admin-border bg-admin-surface px-3.5 py-2">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-admin-foreground/50">
        {label}
      </dt>
      <dd
        className="text-lg font-semibold tabular text-admin-foreground"
        style={tone ? { color: tone } : undefined}
      >
        <CountUp value={value} />
      </dd>
    </div>
  );
}

function ViewModeButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "relative grid h-8 w-8 place-items-center rounded-lg transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
        active ? "text-gold-600" : "text-admin-foreground/45 hover:text-admin-foreground",
      )}
    >
      {active && (
        <motion.span
          layoutId="du-turmas-modo"
          aria-hidden
          className="absolute inset-0 rounded-lg bg-admin-muted"
          transition={
            reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 480, damping: 38 }
          }
        />
      )}
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-admin-border px-4 py-2.5 text-sm text-admin-foreground/60 transition hover:bg-admin-muted hover:text-admin-foreground"
    >
      {children}
    </button>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-admin-border px-6 py-16 text-center"
    >
      <span className="grid h-14 w-14 place-items-center rounded-full bg-admin-muted text-admin-foreground/40">
        <GroupsIcon className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-base font-semibold text-admin-foreground">{title}</h2>
      <p className="mt-1.5 max-w-sm text-sm text-admin-foreground/60">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}
