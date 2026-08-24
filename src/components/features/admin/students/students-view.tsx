"use client";

/**
 * Área de alunos: barra de ferramentas fixa, barra de turmas, busca
 * instantânea e as duas visualizações (cartões e lista) — mesmo modelo da
 * área de Clientes do FV_representante, com turmas no lugar de pastas
 * (turma é gerida em `/admin/turmas`; aqui só se filtra e se arrasta um
 * aluno para lá) e nível CEFR/responsável no lugar de rede/filial.
 *
 * A busca e os filtros são locais: a página já entrega a organização
 * inteira, então filtrar em memória é imediato e não passa termo pela URL.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { deactivateUserAction, reactivateUserAction } from "@/actions/admin/users";
import { getUserByIdAction } from "@/actions/admin/users-detail";
import { moveStudentToGroupAction } from "@/actions/admin/students";
import { CountUp } from "@/components/features/admin/dashboard/primitives";
import {
  EnrollmentConflictDialog,
  type EnrollmentConflict,
} from "@/components/features/groups/enrollment-conflict-dialog";
import {
  CloseIcon,
  GridIcon,
  PlusIcon,
  RowsIcon,
  SearchIcon,
  UserIcon,
} from "@/components/ui/icons";
import { useListProgress, useStickyBar } from "@/components/motion/list-motion";
import { useNarrowScreen, useViewMode } from "@/components/motion/use-view-mode";
import { cn } from "@/lib/utils";
import type { GroupListItem } from "@/repositories/groups";
import type { UserDetail as UserDetailData } from "@/repositories/users";
import { GroupsRail } from "./groups-rail";
import { MoveToGroup } from "./move-to-group";
import { StudentCard } from "./student-card";
import { StudentDetail } from "./student-detail";
import { LIST_GRID, StudentListItem } from "./student-list-item";
import { studentMatches, type GroupFilter, type StatusFilter, type Student } from "./students-utils";

interface StudentsViewProps {
  students: Student[];
  groups: GroupListItem[];
}

/** Transferência aguardando a confirmação do aviso de "um aluno, uma turma". */
interface PendingMove {
  studentId: string;
  groupId: string;
  conflict: EnrollmentConflict;
}

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "active", label: "Ativos" },
  { id: "inactive", label: "Inativos" },
];

const VIEW_MODE_KEY = "du:alunos:modo";

export function StudentsView({ students, groups }: StudentsViewProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [groupFilter, setGroupFilter] = useState<GroupFilter>({ type: "all" });
  const [viewMode, setViewMode] = useViewMode(VIEW_MODE_KEY);
  const narrow = useNarrowScreen();
  const mode = narrow ? "cards" : viewMode;

  const [detailUser, setDetailUser] = useState<UserDetailData | null>(null);
  const [detailStudent, setDetailStudent] = useState<Student | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailSession, setDetailSession] = useState(0);
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);

  const [moveTarget, setMoveTarget] = useState<Student | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { sentinelRef, barRef } = useStickyBar<HTMLDivElement>();
  const lineRef = useListProgress(listRef);

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

  const totals = useMemo(
    () => ({
      total: students.length,
      active: students.filter((s) => s.isActive).length,
      unassigned: students.filter((s) => !s.enrollment).length,
      groups: groups.length,
    }),
    [students, groups],
  );

  /**
   * A turma escolhida delimita tudo o que vem depois: as abas de status
   * contam dentro dela, e a busca só procura ali.
   */
  const inGroup = useMemo(
    () =>
      students.filter((student) => {
        if (groupFilter.type === "none") return !student.enrollment;
        if (groupFilter.type === "group") return student.enrollment?.groupId === groupFilter.id;
        return true;
      }),
    [students, groupFilter],
  );

  const statusCounts: Record<StatusFilter, number> = {
    all: inGroup.length,
    active: inGroup.filter((s) => s.isActive).length,
    inactive: inGroup.filter((s) => !s.isActive).length,
  };

  const filtered = useMemo(
    () =>
      inGroup.filter((student) => {
        if (status === "active" && !student.isActive) return false;
        if (status === "inactive" && student.isActive) return false;
        return studentMatches(student, search);
      }),
    [inGroup, status, search],
  );

  const groupOpenName =
    groupFilter.type === "group"
      ? (groups.find((g) => g.id === groupFilter.id)?.name ?? null)
      : groupFilter.type === "none"
        ? "Sem turma"
        : null;

  async function openDetail(student: Student) {
    setError(null);
    setLoadingDetailId(student.id);
    try {
      const full = await getUserByIdAction(student.id);
      if (!full) {
        setError("Não foi possível carregar este aluno.");
        return;
      }
      setDetailUser(full);
      setDetailStudent(student);
      setDetailSession((n) => n + 1);
      setDetailOpen(true);
    } finally {
      setLoadingDetailId(null);
    }
  }

  async function deactivate(student: Student) {
    setError(null);
    setBusy(student.id);
    try {
      const result = await deactivateUserAction(student.id);
      if (!result.success) setError(result.error.message);
      else router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function reactivate(student: Student) {
    setError(null);
    setBusy(student.id);
    try {
      const result = await reactivateUserAction(student.id);
      if (!result.success) setError(result.error.message);
      else router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function move(studentId: string, groupId: string | null) {
    setError(null);
    setBusy(studentId);
    try {
      const result = await moveStudentToGroupAction(studentId, groupId);
      if (!result.success) setError(result.error.message);
      else router.refresh();
    } finally {
      setBusy(null);
      setPendingMove(null);
    }
  }

  /**
   * Solta um aluno numa turma arrastando o cartão até a barra. Se ele já
   * estiver em outra turma, o arrasto não move sozinho: um aluno pertence a
   * uma turma só, então a transferência (e o fim da matrícula anterior) passa
   * pelo aviso — arrastar é fácil demais para ser irreversível.
   */
  async function dropOnGroup(studentId: string, groupId: string | null) {
    const student = students.find((item) => item.id === studentId);
    if (!student) return;
    const currentGroupId = student.enrollment?.groupId ?? null;
    if (currentGroupId === groupId) return;

    if (currentGroupId && groupId) {
      setError(null);
      setPendingMove({
        studentId,
        groupId,
        conflict: {
          studentName: student.fullName,
          fromGroupName: groups.find((g) => g.id === currentGroupId)?.name ?? "outra turma",
          toGroupName: groups.find((g) => g.id === groupId)?.name ?? "esta turma",
        },
      });
      return;
    }

    await move(studentId, groupId);
  }

  const noStudentsAtAll = students.length === 0;
  const filtersActive = search.trim() !== "" || status !== "all" || groupFilter.type !== "all";
  const groupEmpty = groupOpenName !== null && search.trim() === "" && status === "all";

  return (
    <div className="pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-admin-foreground">Alunos</h1>
          <p className="mt-2 max-w-xl text-sm text-admin-foreground/60">
            Matrículas, turmas e responsáveis dos alunos da organização.
          </p>
        </div>

        <dl className="flex flex-wrap gap-2">
          <Indicator label="Alunos" value={totals.total} />
          <Indicator label="Ativos" value={totals.active} tone="var(--success)" />
          <Indicator label="Turmas" value={totals.groups} tone="var(--gold-600)" />
          <Indicator label="Sem turma" value={totals.unassigned} tone="var(--navy-500)" />
        </dl>
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
                  active ? "text-admin-foreground" : "text-admin-foreground/50 hover:text-admin-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="du-alunos-tab"
                    aria-hidden
                    className="absolute inset-0 rounded-lg bg-admin-muted shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--gold-500)_30%,transparent)]"
                    transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 480, damping: 38 }}
                  />
                )}
                <span className="relative flex items-center gap-1.5">
                  {item.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
                      active ? "bg-gold-100 text-gold-700" : "bg-admin-muted text-admin-foreground/50",
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
            aria-label="Buscar aluno"
            placeholder="Buscar por nome, e-mail, responsável ou turma..."
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

        <div
          role="group"
          aria-label="Modo de visualização"
          className="hidden items-center gap-1 rounded-xl border border-admin-border bg-admin-surface p-1 sm:flex"
        >
          <ViewModeButton active={mode === "cards"} label="Ver em cartões" onClick={() => setViewMode("cards")}>
            <GridIcon className="relative h-4 w-4" />
          </ViewModeButton>
          <ViewModeButton active={mode === "list"} label="Ver em lista" onClick={() => setViewMode("list")}>
            <RowsIcon className="relative h-4 w-4" />
          </ViewModeButton>
        </div>

        <motion.div whileHover={reduceMotion ? undefined : { scale: 1.03 }} whileTap={reduceMotion ? undefined : { scale: 0.97 }}>
          <Link
            href="/admin/usuarios?convite=student"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold-600 to-gold-400 px-3 py-2.5 text-sm font-semibold text-admin-foreground shadow-[0_8px_24px_-12px_rgba(201,162,39,0.75)] transition-opacity hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 sm:px-4"
          >
            <PlusIcon className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Novo aluno</span>
          </Link>
        </motion.div>
      </div>

      <GroupsRail
        groups={groups}
        filter={groupFilter}
        onFilterChange={setGroupFilter}
        unassigned={totals.unassigned}
        total={totals.total}
        dragging={draggingId !== null}
        onDropOnGroup={dropOnGroup}
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
              noStudentsAtAll ? "Nenhum aluno cadastrado" : groupEmpty ? "Turma vazia" : "Nada encontrado"
            }
            description={
              noStudentsAtAll
                ? "Cadastre o primeiro aluno para começar."
                : groupEmpty
                  ? `Nenhum aluno em "${groupOpenName}". Arraste um aluno até a turma, ou use "Mover de turma" no menu dele.`
                  : "Ajuste a busca ou troque os filtros."
            }
            action={
              noStudentsAtAll ? (
                <Link
                  href="/admin/usuarios?convite=student"
                  className="inline-flex items-center gap-2 rounded-xl bg-gold-500 px-4 py-2.5 text-sm font-semibold text-admin-foreground transition-opacity hover:opacity-90"
                >
                  <PlusIcon className="h-4 w-4" />
                  Novo aluno
                </Link>
              ) : filtersActive ? (
                <SecondaryButton
                  onClick={() => {
                    setSearch("");
                    setStatus("all");
                    setGroupFilter({ type: "all" });
                  }}
                >
                  Limpar filtros
                </SecondaryButton>
              ) : null
            }
          />
        ) : mode === "cards" ? (
          <motion.div layout className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <AnimatePresence mode="popLayout" initial={false}>
              {filtered.map((student) => (
                <StudentCard
                  key={student.id}
                  student={student}
                  busy={busy === student.id || loadingDetailId === student.id}
                  onOpen={() => openDetail(student)}
                  onDeactivate={() => deactivate(student)}
                  onReactivate={() => reactivate(student)}
                  onMove={() => setMoveTarget(student)}
                  onDragStart={() => setDraggingId(student.id)}
                  onDragEnd={() => setDraggingId(null)}
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
              <span>Nome</span>
              <span>Turma</span>
              <span>Nível</span>
              <span>Status</span>
              <span>Cadastro</span>
              <span className="text-right">Ações</span>
            </div>
            <motion.div layout className="[&>*:last-child]:rounded-b-2xl">
              <AnimatePresence mode="popLayout" initial={false}>
                {filtered.map((student) => (
                  <StudentListItem
                    key={student.id}
                    student={student}
                    busy={busy === student.id || loadingDetailId === student.id}
                    onOpen={() => openDetail(student)}
                    onDeactivate={() => deactivate(student)}
                    onReactivate={() => reactivate(student)}
                    onMove={() => setMoveTarget(student)}
                    onDragStart={() => setDraggingId(student.id)}
                    onDragEnd={() => setDraggingId(null)}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <p className="mt-4 text-xs text-admin-foreground/50">
          Exibindo {filtered.length} de {totals.total} {totals.total === 1 ? "aluno" : "alunos"}.
        </p>
      )}

      <StudentDetail
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        user={detailUser}
        student={detailStudent}
        session={detailSession}
        onMove={() => detailStudent && setMoveTarget(detailStudent)}
      />

      <MoveToGroup open={moveTarget !== null} student={moveTarget} groups={groups} onClose={() => setMoveTarget(null)} />

      <EnrollmentConflictDialog
        conflict={pendingMove?.conflict ?? null}
        busy={busy !== null}
        onConfirm={() => {
          if (pendingMove) void move(pendingMove.studentId, pendingMove.groupId);
        }}
        onCancel={() => setPendingMove(null)}
      />
    </div>
  );
}

function Indicator({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-admin-border bg-admin-surface px-3.5 py-2">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-admin-foreground/50">{label}</dt>
      <dd
        className="text-lg font-semibold tabular-nums text-admin-foreground"
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
          layoutId="du-alunos-modo"
          aria-hidden
          className="absolute inset-0 rounded-lg bg-admin-muted"
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 480, damping: 38 }}
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

function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-admin-border px-6 py-16 text-center"
    >
      <span className="grid h-14 w-14 place-items-center rounded-full bg-admin-muted text-admin-foreground/40">
        <UserIcon className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-base font-semibold text-admin-foreground">{title}</h2>
      <p className="mt-1.5 max-w-sm text-sm text-admin-foreground/60">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}
