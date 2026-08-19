"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CountUp } from "@/components/features/admin/dashboard/primitives";
import { CalendarIcon, GroupsIcon, TaskIcon } from "@/components/ui/icons";
import type { GradedAssignmentRow, GroupProgress } from "@/repositories/progress";
import type { CefrLevel } from "@/types/domain";

function KpiCard({
  icon,
  label,
  children,
  index,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  index: number;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: "easeOut" }}
      className="rounded-2xl border border-border bg-background p-5 shadow-[var(--shadow-card)]"
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-50 text-navy-700">
          {icon}
        </span>
        {label}
      </div>
      <p className="mt-3 text-3xl font-semibold text-navy-900">{children}</p>
    </motion.div>
  );
}

function AttendanceRow({ group, index }: { group: GroupProgress; index: number }) {
  const reduceMotion = useReducedMotion();
  const low = group.attendanceRate < 75;

  return (
    <motion.li
      initial={reduceMotion ? false : { opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3) }}
      className="space-y-1.5 px-4 py-3"
    >
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-navy-900">{group.groupName}</span>
        <span className={cn("tabular font-medium", low ? "text-warning" : "text-navy-700")}>
          {group.attendanceRate.toFixed(0)}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-navy-100">
        <motion.div
          initial={reduceMotion ? false : { scaleX: 0 }}
          animate={{ scaleX: Math.min(group.attendanceRate / 100, 1) }}
          transition={{ type: "spring", stiffness: 120, damping: 20, delay: 0.1 }}
          style={{ transformOrigin: "left" }}
          className={cn("h-full w-full rounded-full", low ? "bg-warning" : "bg-navy-600")}
        />
      </div>
    </motion.li>
  );
}

function GradeRow({ grade, index }: { grade: GradedAssignmentRow; index: number }) {
  const reduceMotion = useReducedMotion();
  const percent =
    grade.score != null && grade.maxScore ? (100 * grade.score) / grade.maxScore : null;
  const tone =
    percent == null
      ? "text-navy-700"
      : percent >= 70
        ? "text-success"
        : percent >= 50
          ? "text-warning"
          : "text-destructive";

  return (
    <motion.li
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.3) }}
      className="flex items-center justify-between gap-3 px-4 py-3"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-navy-900">{grade.title}</p>
        <p className="truncate text-xs text-muted-foreground">{grade.groupName}</p>
      </div>
      <span className={cn("tabular flex-none text-sm font-semibold", tone)}>
        {grade.score ?? "—"}
        {grade.maxScore ? ` / ${grade.maxScore}` : ""}
      </span>
    </motion.li>
  );
}

export function StudentProgressView({
  currentLevel,
  completedSessions,
  groups,
  grades,
}: {
  currentLevel: CefrLevel | null;
  completedSessions: number;
  groups: GroupProgress[];
  grades: GradedAssignmentRow[];
}) {
  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-navy-900">Meu progresso</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Nível, frequência e notas — tudo num só lugar.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <KpiCard icon={<GroupsIcon className="h-4 w-4" />} label="Nível atual" index={0}>
          {currentLevel ?? "—"}
        </KpiCard>
        <KpiCard icon={<CalendarIcon className="h-4 w-4" />} label="Aulas concluídas" index={1}>
          <CountUp value={completedSessions} />
        </KpiCard>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Frequência por turma
        </h2>
        {groups.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-muted/40 p-8 text-center text-muted-foreground">
            Nenhuma matrícula ativa.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-background shadow-[var(--shadow-card)]">
            {groups.map((group, index) => (
              <AttendanceRow key={group.groupId} group={group} index={index} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <TaskIcon className="h-4 w-4" />
          Notas de tarefas
        </h2>
        {grades.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-muted/40 p-8 text-center text-muted-foreground">
            Nenhuma tarefa corrigida ainda.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-background shadow-[var(--shadow-card)]">
            {grades.map((grade, index) => (
              <GradeRow key={`${grade.title}-${grade.groupName}-${index}`} grade={grade} index={index} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
