"use client";

/**
 * Planejador de aulas — a tela onde a aula nasce, entra na agenda e começa.
 *
 * Duas abas, porque são dois modos de pensar: o *ateliê* é a biblioteca de
 * aulas prontas (conteúdo, sem data) e a *agenda* é o calendário do que vai
 * ao ar (data, turma, professor). O caminho normal atravessa as duas —
 * criar no ateliê, agendar para a turma, dar a aula pelo botão da agenda.
 *
 * Divisão das libs de animação, como no resto do painel: Framer Motion cuida
 * do ciclo de vida do React (troca de aba, entrada dos cartões, hover) e o
 * GSAP cuida do imperativo (abertura da tela, contadores, fio da lista).
 */

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  cancelSessionAction,
  deletePlannerPlanAction,
  duplicatePlannerPlanAction,
} from "@/actions/admin/lesson-planner";
import { deletePlannerAssignmentAction } from "@/actions/admin/assignments";
import { CountUp } from "@/components/features/admin/dashboard/primitives";
import { useListProgress } from "@/components/motion/list-motion";
import { SlideTabs } from "@/components/ui/slide-tabs";
import {
  CalendarIcon,
  CopyIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TaskIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { useArea } from "@/components/features/admin/area-context";
import { AssignmentPanel } from "./assignment-panel";
import { PlanFormPanel } from "./plan-form-panel";
import { SchedulePanel } from "./schedule-panel";
import {
  STATUS_META,
  dayKey,
  formatDay,
  formatTime,
  formatWeekday,
  relativeFrom,
  todayKey,
} from "./planner-utils";
import type {
  PlannerGroupOption,
  PlannerPlan,
  PlannerSession,
} from "@/repositories/lesson-planner";
import type { PlannerAssignmentListItem } from "@/repositories/assignments";
import type { UserListItem } from "@/repositories/users";
import { LogoLoader } from "@/components/ui/logo-loader";

type Tab = "atelie" | "agenda" | "tarefas";
type AgendaFilter = "proximas" | "hoje" | "aovivo" | "concluidas";

const AGENDA_FILTERS: { value: AgendaFilter; label: string }[] = [
  { value: "proximas", label: "Próximas" },
  { value: "hoje", label: "Hoje" },
  { value: "aovivo", label: "Ao vivo" },
  { value: "concluidas", label: "Concluídas" },
];

export interface PlannerViewProps {
  plans: PlannerPlan[];
  sessions: PlannerSession[];
  groups: PlannerGroupOption[];
  teachers: UserListItem[];
  assignments: PlannerAssignmentListItem[];
  /**
   * Quando presente, só os planos deste autor mostram editar/excluir — é
   * assim que o professor usa um plano compartilhado sem poder reescrevê-lo
   * (a action confere a autoria de novo; isto é só a interface honesta).
   */
  editableAuthorId?: string;
  /** `?nova` na URL abre o painel de criação já na primeira pintura. */
  openCreate?: boolean;
}

export function PlannerView({
  plans,
  sessions,
  groups,
  teachers,
  assignments,
  editableAuthorId,
  openCreate = false,
}: PlannerViewProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [tab, setTab] = useState<Tab>("atelie");
  const [search, setSearch] = useState("");
  const [agendaFilter, setAgendaFilter] = useState<AgendaFilter>("proximas");

  const [formOpen, setFormOpen] = useState(openCreate);
  const [editing, setEditing] = useState<PlannerPlan | undefined>(undefined);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedulePlanId, setSchedulePlanId] = useState<string | undefined>(undefined);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const headerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const lineRef = useListProgress(listRef);

  // Abertura da tela: cabeçalho e indicadores entram uma vez, no load. A
  // limpeza é `revert()` — `kill()` deixaria os elementos parados no estado
  // inicial do `from()` (invisíveis) se o efeito for desmontado antes do fim.
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const targets = header.querySelectorAll<HTMLElement>("[data-enter]");
    if (targets.length === 0) return;

    if (reduceMotion) {
      gsap.set(targets, { clearProps: "opacity,transform" });
      return;
    }

    const tween = gsap.from(targets, {
      y: 14,
      opacity: 0,
      duration: 0.5,
      ease: "power3.out",
      stagger: 0.06,
      clearProps: "opacity,transform",
    });

    return () => {
      tween.revert();
    };
  }, [reduceMotion]);

  const today = todayKey();

  const stats = useMemo(() => {
    const live = sessions.filter((item) => item.status === "in_progress").length;
    const upcoming = sessions.filter(
      (item) => item.status === "scheduled" && new Date(item.scheduledAt) >= new Date(),
    ).length;
    const done = sessions.filter((item) => item.status === "completed").length;
    return { plans: plans.length, upcoming, live, done };
  }, [plans, sessions]);

  const visiblePlans = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return plans;
    return plans.filter((plan) =>
      [plan.title, plan.summary ?? "", plan.level, plan.authorName]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [plans, search]);

  const visibleSessions = useMemo(() => {
    const now = Date.now();
    return sessions.filter((session) => {
      if (agendaFilter === "hoje") return dayKey(session.scheduledAt) === today;
      if (agendaFilter === "aovivo") return session.status === "in_progress";
      if (agendaFilter === "concluidas") return session.status === "completed";
      return (
        session.status === "in_progress" ||
        (session.status === "scheduled" &&
          new Date(session.scheduledAt).getTime() > now - 3 * 3600_000)
      );
    });
  }, [sessions, agendaFilter, today]);

  const visibleAssignments = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return assignments;
    return assignments.filter((item) =>
      [item.title, item.groupName].join(" ").toLowerCase().includes(term),
    );
  }, [assignments, search]);

  const groupedSessions = useMemo(() => {
    const map = new Map<string, PlannerSession[]>();
    for (const session of visibleSessions) {
      const key = dayKey(session.scheduledAt);
      const bucket = map.get(key);
      if (bucket) bucket.push(session);
      else map.set(key, [session]);
    }
    return Array.from(map.entries());
  }, [visibleSessions]);

  function runPlanAction(
    id: string,
    action: () => Promise<{ success: boolean; error?: { message: string } }>,
  ) {
    setBusyId(id);
    setError(null);
    startTransition(async () => {
      const result = await action();
      setBusyId(null);
      if (!result.success) setError(result.error?.message ?? "Não foi possível concluir.");
      else router.refresh();
    });
  }

  return (
    <div className="mx-auto w-full max-w-[1800px] pb-16">
      <div ref={headerRef}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p
              data-enter
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-600"
            >
              Planejamento pedagógico
            </p>
            <h1
              data-enter
              className="mt-1 text-3xl font-bold tracking-tight text-admin-foreground"
            >
              Planejador de aulas
            </h1>
            <p data-enter className="mt-1.5 max-w-2xl text-sm text-admin-foreground/60">
              Monte a aula num canvas livre — texto, imagens coladas na hora, tabelas —,
              agende para a turma e dê a aula sem sair daqui.
            </p>
          </div>

          <div data-enter className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAssignmentOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-admin-border bg-admin-surface px-4 text-sm font-medium text-admin-foreground/80 transition-colors hover:bg-admin-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
            >
              <TaskIcon className="h-4 w-4" />
              Nova tarefa
            </button>
            <button
              type="button"
              onClick={() => {
                setSchedulePlanId(undefined);
                setScheduleOpen(true);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-admin-border bg-admin-surface px-4 text-sm font-medium text-admin-foreground/80 transition-colors hover:bg-admin-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
            >
              <CalendarIcon className="h-4 w-4" />
              Agendar aula
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-gold-600 to-gold-400 px-4 text-sm font-semibold text-admin-foreground shadow-[0_8px_24px_-12px_rgba(201,162,39,0.75)] transition-opacity hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
            >
              <PlusIcon className="h-4 w-4" />
              Nova aula
            </button>
          </div>
        </div>

        <div data-enter className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Aulas no ateliê" value={stats.plans} hint="planos criados" />
          <StatCard
            label="Agendadas"
            value={stats.upcoming}
            hint="ainda vão acontecer"
            tone="navy"
          />
          <StatCard
            label="Ao vivo agora"
            value={stats.live}
            hint={stats.live > 0 ? "em andamento" : "nenhuma acontecendo"}
            tone="live"
          />
          <StatCard
            label="Concluídas"
            value={stats.done}
            hint="nos últimos 45 dias"
            tone="muted"
          />
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <SlideTabs
          tone="surface"
          label="Modo do planejador"
          value={tab}
          onValueChange={(value) => setTab(value as Tab)}
          items={[
            { label: "Ateliê", value: "atelie" },
            { label: "Agenda", value: "agenda" },
            { label: "Tarefas", value: "tarefas" },
          ]}
        />

        {tab === "agenda" ? (
          <div className="flex flex-wrap gap-1.5">
            {AGENDA_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setAgendaFilter(filter.value)}
                aria-pressed={agendaFilter === filter.value}
                className={cn(
                  "h-9 rounded-full border px-3.5 text-xs font-semibold uppercase tracking-[0.1em] transition-colors",
                  agendaFilter === filter.value
                    ? "border-navy-900 bg-navy-900 text-white"
                    : "border-admin-border bg-admin-surface text-admin-foreground/60 hover:bg-admin-muted",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        ) : (
          <label className="relative flex h-10 w-full max-w-xs items-center">
            <SearchIcon className="pointer-events-none absolute left-3 h-4 w-4 text-admin-foreground/40" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                tab === "atelie" ? "Buscar aula, nível, autor…" : "Buscar tarefa, turma…"
              }
              aria-label={tab === "atelie" ? "Buscar aula" : "Buscar tarefa"}
              className="h-10 w-full rounded-xl border border-admin-border bg-admin-surface pl-9 pr-3 text-sm text-admin-foreground placeholder:text-admin-foreground/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
            />
          </label>
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="relative mt-5">
        <span
          ref={lineRef}
          aria-hidden
          className="absolute -top-2 left-0 h-px w-full origin-left bg-gradient-to-r from-gold-500 to-transparent"
        />

        <AnimatePresence mode="wait">
          {tab === "atelie" ? (
            <motion.div
              key="atelie"
              ref={listRef}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: reduceMotion ? 0 : 0.24 }}
            >
              {visiblePlans.length === 0 ? (
                <EmptyBoard
                  title={search ? "Nenhuma aula encontrada" : "O ateliê está vazio"}
                  body={
                    search
                      ? "Tente outro termo — busca por título, resumo, nível ou autor."
                      : "Crie a primeira aula: um canvas em branco onde você escreve, cola imagens e monta a atividade."
                  }
                  action={
                    search ? undefined : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(undefined);
                          setFormOpen(true);
                        }}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-navy-900 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                      >
                        <PlusIcon className="h-4 w-4" />
                        Criar primeira aula
                      </button>
                    )
                  }
                />
              ) : (
                <motion.div
                  layout={!reduceMotion}
                  className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
                >
                  <AnimatePresence initial={false}>
                    {visiblePlans.map((plan, index) => (
                      <PlanCard
                        key={plan.id}
                        plan={plan}
                        index={index}
                        busy={busyId === plan.id}
                        onEdit={() => {
                          setEditing(plan);
                          setFormOpen(true);
                        }}
                        onSchedule={() => {
                          setSchedulePlanId(plan.id);
                          setScheduleOpen(true);
                        }}
                        onDuplicate={() =>
                          runPlanAction(plan.id, () => duplicatePlannerPlanAction(plan.id))
                        }
                        onDelete={() => {
                          if (
                            !window.confirm(
                              `Excluir "${plan.title}"? As aulas já dadas a partir dele não são afetadas.`,
                            )
                          )
                            return;
                          runPlanAction(plan.id, () => deletePlannerPlanAction(plan.id));
                        }}
                        canEdit={
                          editableAuthorId === undefined ||
                          plan.authorId === editableAuthorId
                        }
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </motion.div>
          ) : tab === "agenda" ? (
            <motion.div
              key="agenda"
              ref={listRef}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: reduceMotion ? 0 : 0.24 }}
              className="space-y-8"
            >
              {groupedSessions.length === 0 ? (
                <EmptyBoard
                  title="Nada na agenda"
                  body="Agende uma aula para uma turma — ela aparece aqui com o botão de começar."
                  action={
                    <button
                      type="button"
                      onClick={() => {
                        setSchedulePlanId(undefined);
                        setScheduleOpen(true);
                      }}
                      className="inline-flex h-10 items-center gap-2 rounded-xl bg-navy-900 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    >
                      <CalendarIcon className="h-4 w-4" />
                      Agendar aula
                    </button>
                  }
                />
              ) : (
                groupedSessions.map(([key, items]) => (
                  <section key={key}>
                    <div className="mb-3 flex items-baseline gap-3">
                      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-admin-foreground/60">
                        {key === today ? "Hoje" : formatWeekday(items[0]!.scheduledAt)}
                      </h2>
                      <span className="text-xs text-admin-foreground/45">
                        {formatDay(items[0]!.scheduledAt)}
                      </span>
                      <span className="h-px flex-1 bg-gradient-to-r from-gold-300 to-transparent" />
                    </div>

                    <div className="space-y-2.5">
                      {items.map((session, index) => (
                        <SessionRow
                          key={session.id}
                          session={session}
                          index={index}
                          busy={busyId === session.id}
                          onCancel={() => {
                            if (
                              !window.confirm(
                                `Cancelar a aula "${session.title}" de ${session.groupName}?`,
                              )
                            )
                              return;
                            runPlanAction(session.id, () =>
                              cancelSessionAction(session.id),
                            );
                          }}
                        />
                      ))}
                    </div>
                  </section>
                ))
              )}
            </motion.div>
          ) : (
            <motion.div
              key="tarefas"
              ref={listRef}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: reduceMotion ? 0 : 0.24 }}
              className="space-y-2.5"
            >
              {visibleAssignments.length === 0 ? (
                <EmptyBoard
                  title={search ? "Nenhuma tarefa encontrada" : "Nenhuma tarefa enviada ainda"}
                  body={
                    search
                      ? "Tente outro termo — busca por título ou turma."
                      : "Crie um exercício e escolha para quais turmas ele vai — cada turma recebe sua própria entrega."
                  }
                  action={
                    search ? undefined : (
                      <button
                        type="button"
                        onClick={() => setAssignmentOpen(true)}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-navy-900 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                      >
                        <TaskIcon className="h-4 w-4" />
                        Criar primeira tarefa
                      </button>
                    )
                  }
                />
              ) : (
                <AnimatePresence initial={false}>
                  {visibleAssignments.map((assignment, index) => (
                    <TaskRow
                      key={assignment.id}
                      assignment={assignment}
                      index={index}
                      busy={busyId === assignment.id}
                      onDelete={() => {
                        if (
                          !window.confirm(
                            `Excluir a tarefa "${assignment.title}" da turma ${assignment.groupName}?`,
                          )
                        )
                          return;
                        runPlanAction(assignment.id, () =>
                          deletePlannerAssignmentAction(assignment.id),
                        );
                      }}
                    />
                  ))}
                </AnimatePresence>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <PlanFormPanel
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(undefined);
        }}
        plan={editing}
      />

      <SchedulePanel
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        groups={groups}
        plans={plans}
        teachers={teachers}
        defaultPlanId={schedulePlanId}
      />

      <AssignmentPanel
        open={assignmentOpen}
        onClose={() => setAssignmentOpen(false)}
        groups={groups}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = "gold",
}: {
  label: string;
  value: number;
  hint: string;
  tone?: "gold" | "navy" | "live" | "muted";
}) {
  const accent =
    tone === "navy"
      ? "from-navy-600 to-navy-300"
      : tone === "live"
        ? "from-emerald-500 to-emerald-200"
        : tone === "muted"
          ? "from-admin-border to-transparent"
          : "from-gold-600 to-gold-300";

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-admin-border bg-admin-surface px-4 py-3.5 shadow-[0_1px_2px_rgba(11,26,51,0.04),0_10px_30px_-22px_rgba(11,26,51,0.4)]">
      <span
        aria-hidden
        className={cn("absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r", accent)}
      />
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-admin-foreground/50">
        {label}
      </p>
      <p className="mt-1 text-3xl font-bold tabular text-admin-foreground">
        <CountUp value={value} />
      </p>
      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-admin-foreground/50">
        {tone === "live" && value > 0 && (
          <span className="live-dot relative inline-block h-2 w-2 rounded-full bg-[var(--success)]" />
        )}
        {hint}
      </p>
    </div>
  );
}

function PlanCard({
  plan,
  index,
  busy,
  onEdit,
  onSchedule,
  onDuplicate,
  onDelete,
  canEdit,
}: {
  plan: PlannerPlan;
  index: number;
  busy: boolean;
  onEdit: () => void;
  onSchedule: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  /** Reescrever este plano é permitido — falso em plano compartilhado alheio. */
  canEdit: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const { base } = useArea();

  return (
    <motion.article
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{
        type: "spring",
        stiffness: 320,
        damping: 30,
        delay: reduceMotion ? 0 : Math.min(index * 0.035, 0.25),
      }}
      whileHover={reduceMotion ? undefined : { y: -4 }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-admin-border bg-admin-surface p-5 shadow-[0_1px_2px_rgba(11,26,51,0.04),0_10px_30px_-22px_rgba(11,26,51,0.4)] transition-[box-shadow,border-color] hover:border-gold-300 hover:shadow-[0_2px_6px_rgba(11,26,51,0.06),0_26px_50px_-30px_rgba(11,26,51,0.5)]"
    >
      <span
        aria-hidden
        className="tone-glow pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
      />

      <div className="relative flex items-start justify-between gap-3">
        <span className="inline-flex h-6 items-center rounded-full border border-gold-300 bg-gold-50 px-2.5 text-[11px] font-bold tracking-wide text-gold-700">
          {plan.level}
        </span>
        <span className="text-[11px] text-admin-foreground/45">
          {relativeFrom(plan.updatedAt)}
        </span>
      </div>

      <Link
        href={`${base}/planejador/${plan.id}` as Route}
        className="relative mt-3 line-clamp-2 text-lg font-semibold leading-snug text-admin-foreground transition-colors hover:text-navy-700 focus:outline-none focus-visible:underline"
      >
        {plan.title}
        <span className="absolute inset-0" aria-hidden />
      </Link>

      <p className="relative mt-1.5 line-clamp-2 min-h-[2.5rem] text-sm text-admin-foreground/60">
        {plan.summary ?? "Sem resumo."}
      </p>

      <div className="relative mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-admin-foreground/50">
        <span>{plan.durationMinutes} min</span>
        <span aria-hidden>·</span>
        <span className="truncate">{plan.authorName}</span>
        {plan.scheduledCount > 0 && (
          <>
            <span aria-hidden>·</span>
            <span className="font-medium text-navy-700">
              {plan.scheduledCount} agendamento(s)
            </span>
          </>
        )}
        {plan.isShared && (
          <span className="rounded-full bg-navy-50 px-2 py-0.5 font-medium text-navy-700">
            compartilhada
          </span>
        )}
      </div>

      <div className="relative z-10 mt-4 flex items-center gap-1.5 border-t border-admin-border/70 pt-3">
        <Link
          href={`${base}/planejador/${plan.id}` as Route}
          className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-navy-900 px-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Abrir canvas
        </Link>
        <IconAction label="Agendar" onClick={onSchedule} disabled={busy}>
          <CalendarIcon className="h-4 w-4" />
        </IconAction>
        {canEdit && (
          <IconAction label="Editar ficha" onClick={onEdit} disabled={busy}>
            <PencilIcon className="h-4 w-4" />
          </IconAction>
        )}
        <IconAction label="Duplicar" onClick={onDuplicate} disabled={busy}>
          {busy ? <LogoLoader size={16} label={null} /> : <CopyIcon className="h-4 w-4" />}
        </IconAction>
        {canEdit && (
          <IconAction label="Excluir" onClick={onDelete} disabled={busy} danger>
            <TrashIcon className="h-4 w-4" />
          </IconAction>
        )}
      </div>
    </motion.article>
  );
}

function IconAction({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-lg border border-admin-border bg-admin-surface transition-colors",
        danger
          ? "text-red-600 hover:border-red-200 hover:bg-red-50"
          : "text-admin-foreground/60 hover:bg-admin-muted hover:text-admin-foreground",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      {children}
    </button>
  );
}

function SessionRow({
  session,
  index,
  busy,
  onCancel,
}: {
  session: PlannerSession;
  index: number;
  busy: boolean;
  onCancel: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const { base } = useArea();
  const status = STATUS_META[session.status];
  const live = session.status === "in_progress";

  const cta =
    session.status === "scheduled"
      ? "Dar aula"
      : live
        ? "Continuar aula"
        : "Ver registro";

  return (
    <motion.div
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{
        type: "spring",
        stiffness: 340,
        damping: 32,
        delay: reduceMotion ? 0 : Math.min(index * 0.03, 0.2),
      }}
      className={cn(
        "group flex flex-wrap items-center gap-4 rounded-2xl border bg-admin-surface px-4 py-3.5 transition-[border-color,box-shadow]",
        live
          ? "border-emerald-200 shadow-[0_0_0_1px_rgba(16,122,90,0.08),0_18px_40px_-30px_rgba(16,122,90,0.6)]"
          : "border-admin-border hover:border-navy-100 hover:shadow-[0_18px_40px_-32px_rgba(11,26,51,0.6)]",
      )}
    >
      <div className="flex w-[70px] shrink-0 flex-col">
        <span className="text-lg font-bold tabular leading-none text-admin-foreground">
          {formatTime(session.scheduledAt)}
        </span>
        <span className="mt-1 text-[11px] text-admin-foreground/45">
          {session.durationMinutes} min
        </span>
      </div>

      <div className="min-w-[200px] flex-1">
        <p className="flex items-center gap-2 font-semibold text-admin-foreground">
          {live && (
            <span className="live-dot relative inline-block h-2 w-2 rounded-full bg-[var(--success)]" />
          )}
          <span className="truncate">{session.title}</span>
        </p>
        <p className="mt-0.5 truncate text-xs text-admin-foreground/55">
          {session.groupName} · {session.teacherName} · {session.studentCount} aluno(s)
          {session.planTitle ? ` · plano: ${session.planTitle}` : ""}
        </p>
      </div>

      <span
        className={cn(
          "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold",
          status.className,
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} aria-hidden />
        {status.label}
      </span>

      <div className="flex shrink-0 items-center gap-1.5">
        <Link
          href={`${base}/planejador/aula/${session.id}` as Route}
          className={cn(
            "inline-flex h-9 items-center rounded-lg px-3.5 text-sm font-semibold transition-opacity hover:opacity-90",
            live
              ? "bg-[var(--success)] text-white"
              : session.status === "scheduled"
                ? "bg-navy-900 text-white"
                : "border border-admin-border text-admin-foreground/70",
          )}
        >
          {cta}
        </Link>
        {session.status === "scheduled" && (
          <IconAction label="Cancelar aula" onClick={onCancel} disabled={busy} danger>
            {busy ? (
              <LogoLoader size={16} label={null} />
            ) : (
              <TrashIcon className="h-4 w-4" />
            )}
          </IconAction>
        )}
      </div>
    </motion.div>
  );
}

function TaskRow({
  assignment,
  index,
  busy,
  onDelete,
}: {
  assignment: PlannerAssignmentListItem;
  index: number;
  busy: boolean;
  onDelete: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const { base } = useArea();
  const overdue = assignment.dueAt ? new Date(assignment.dueAt) < new Date() : false;

  return (
    <motion.div
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{
        type: "spring",
        stiffness: 340,
        damping: 32,
        delay: reduceMotion ? 0 : Math.min(index * 0.03, 0.2),
      }}
      className="group flex flex-wrap items-center gap-4 rounded-2xl border border-admin-border bg-admin-surface px-4 py-3.5 transition-[border-color,box-shadow] hover:border-navy-100 hover:shadow-[0_18px_40px_-32px_rgba(11,26,51,0.6)]"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy-50 text-navy-700">
        <TaskIcon className="h-5 w-5" />
      </span>

      <Link
        href={`${base}/planejador/tarefa/${assignment.id}` as Route}
        className="min-w-[200px] flex-1 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
      >
        <p className="truncate font-semibold text-admin-foreground">{assignment.title}</p>
        <p className="mt-0.5 truncate text-xs text-admin-foreground/55">
          {assignment.groupName}
          {assignment.questionCount > 0
            ? ` · ${assignment.questionCount} questão(ões)`
            : " · resposta livre"}
          {assignment.maxScore != null ? ` · nota máxima ${assignment.maxScore}` : ""}
          {assignment.submissionCount > 0
            ? ` · ${assignment.submissionCount} entrega(s)`
            : ""}
        </p>
      </Link>

      {assignment.pendingReviewCount > 0 && (
        <span className="inline-flex h-6 shrink-0 items-center rounded-full border border-gold-300 bg-gold-50 px-2.5 text-[11px] font-semibold text-gold-700">
          {assignment.pendingReviewCount} para corrigir
        </span>
      )}

      {assignment.dueAt && (
        <span
          className={cn(
            "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold",
            overdue
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-navy-100 bg-navy-50 text-navy-800",
          )}
        >
          <CalendarIcon className="h-3 w-3" />
          {formatDay(assignment.dueAt)}
        </span>
      )}

      <div className="flex shrink-0 items-center gap-1.5">
        <IconAction label="Excluir tarefa" onClick={onDelete} disabled={busy} danger>
          {busy ? (
            <LogoLoader size={16} label={null} />
          ) : (
            <TrashIcon className="h-4 w-4" />
          )}
        </IconAction>
      </div>
    </motion.div>
  );
}

function EmptyBoard({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-admin-border bg-admin-surface/60 px-6 py-16 text-center">
      <p className="text-base font-semibold text-admin-foreground">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-admin-foreground/55">{body}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
