"use client";

/**
 * Peças visuais do domínio de turmas. O anel de lotação é a peça central: é
 * o que responde, num relance, a única pergunta que se faz olhando uma lista
 * de turmas — "cabe mais alguém aqui?".
 *
 * Nível CEFR e status reaproveitam os selos das áreas de alunos/usuários; o
 * que existe só aqui é lotação, horário e o selo do professor responsável.
 */

import { motion, useReducedMotion } from "framer-motion";
import { CalendarIcon, GraduationIcon, GroupsIcon, UserIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import {
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  initialsOf,
  occupancyLabel,
  occupancyRatio,
  occupancyTone,
  sortedSchedule,
  toneOf,
  type Group,
} from "./groups-utils";
import type { ScheduleEntry } from "@/schemas/groups";

export { LevelPill } from "@/components/features/admin/students/students-visuals";
export { CopyButton } from "@/components/features/admin/users/users-visuals";

/**
 * Anel de lotação. O arco é um `circle` com `pathLength={1}` — assim o
 * `strokeDashoffset` é a própria fração de ocupação, sem contas com raio, e o
 * framer-motion anima só esse número (nada de layout thrash).
 */
export function OccupancyRing({
  group,
  size = 76,
  className,
}: {
  group: Group;
  size?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const ratio = occupancyRatio(group);
  const tone = occupancyTone(group);
  const stroke = size >= 64 ? 6 : 5;

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${group.enrolledCount} de ${group.maxStudents} alunos — ${occupancyLabel(group)}`}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke="var(--admin-muted)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1 1"
          initial={reduceMotion ? { strokeDashoffset: 1 - ratio } : { strokeDashoffset: 1 }}
          animate={{ strokeDashoffset: 1 - ratio }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>

      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span
          className="text-[15px] font-semibold tabular"
          style={{ color: tone }}
        >
          {group.enrolledCount}
        </span>
        <span className="mt-0.5 text-[10px] text-admin-foreground/45 tabular">
          de {group.maxStudents}
        </span>
      </span>
    </div>
  );
}

/** Barra de lotação — a versão achatada do anel, para a linha da lista. */
export function OccupancyBar({ group, className }: { group: Group; className?: string }) {
  const reduceMotion = useReducedMotion();
  const ratio = occupancyRatio(group);
  const tone = occupancyTone(group);

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-baseline justify-between gap-2 text-[11px]">
        <span className="font-medium tabular text-admin-foreground/70">
          {group.enrolledCount}/{group.maxStudents}
        </span>
        <span className="truncate text-admin-foreground/45">{occupancyLabel(group)}</span>
      </div>
      <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-admin-muted">
        <motion.span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ backgroundColor: tone }}
          initial={reduceMotion ? { width: `${ratio * 100}%` } : { width: 0 }}
          animate={{ width: `${ratio * 100}%` }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        />
        {ratio >= 1 && (
          <span aria-hidden className="progress-shimmer absolute inset-0" />
        )}
      </div>
    </div>
  );
}

export function GroupStatusPill({ isActive }: { isActive: boolean }) {
  const tone = isActive ? "var(--success)" : "var(--muted-foreground)";

  return (
    <span
      style={{ color: tone, backgroundColor: `color-mix(in srgb, ${tone} 10%, #ffffff)` }}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tone }} />
      {isActive ? "Ativa" : "Arquivada"}
    </span>
  );
}

/** Professor responsável, com o mesmo avatar de iniciais das outras áreas. */
export function TeacherPill({
  id,
  name,
  className,
}: {
  id: string;
  name: string;
  className?: string;
}) {
  const tone = toneOf(id || name);

  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-2 rounded-full border border-admin-border bg-admin-surface py-1 pl-1 pr-2.5 text-[11px] text-admin-foreground/75",
        className,
      )}
    >
      <span
        aria-hidden
        style={{
          color: tone,
          backgroundColor: `color-mix(in srgb, ${tone} 12%, #ffffff)`,
          boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone} 26%, transparent)`,
        }}
        className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[9px] font-semibold"
      >
        {initialsOf(name)}
      </span>
      <span className="truncate">{name}</span>
    </span>
  );
}

export function CoursePill({ name, className }: { name: string | null; className?: string }) {
  if (!name) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-dashed border-admin-border px-2.5 py-1 text-[11px] text-admin-foreground/40",
          className,
        )}
      >
        <GraduationIcon className="h-3 w-3" />
        Sem curso
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 rounded-full border border-admin-border px-2.5 py-1 text-[11px] text-admin-foreground/70",
        className,
      )}
    >
      <GraduationIcon className="h-3 w-3 shrink-0 text-gold-600" />
      <span className="max-w-[10rem] truncate">{name}</span>
    </span>
  );
}

/**
 * Grade semanal em chips. `compact` mostra só a inicial do dia — cabe na
 * coluna estreita da lista sem virar reticências.
 */
export function ScheduleChips({
  schedule,
  compact = false,
  max,
  className,
}: {
  schedule: ScheduleEntry[];
  compact?: boolean;
  /** Corta a grade e resume o resto em "+N" — cartões não crescem sem limite. */
  max?: number;
  className?: string;
}) {
  const entries = sortedSchedule(schedule);

  if (entries.length === 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-[11px] italic text-admin-foreground/40",
          className,
        )}
      >
        <CalendarIcon className="h-3.5 w-3.5" />
        Sem horários definidos
      </span>
    );
  }

  const shown = max ? entries.slice(0, max) : entries;
  const hidden = entries.length - shown.length;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {shown.map((entry, index) => (
        <span
          key={`${entry.weekday}-${entry.start}-${index}`}
          title={`${WEEKDAY_LONG[entry.weekday]} · ${entry.start} às ${entry.end}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-admin-muted px-2 py-1 text-[11px] text-admin-foreground/70"
        >
          <span className="font-semibold uppercase tracking-wide text-gold-700">
            {WEEKDAY_SHORT[entry.weekday]}
          </span>
          <span className="tabular">
            {entry.start}
            {compact ? "" : `–${entry.end}`}
          </span>
        </span>
      ))}
      {hidden > 0 && (
        <span className="rounded-lg border border-dashed border-admin-border px-2 py-1 text-[11px] text-admin-foreground/45">
          +{hidden}
        </span>
      )}
    </div>
  );
}

/** Marca discreta de turma sem nenhum aluno — o que o admin precisa resolver. */
export function EmptyGroupPill() {
  return (
    <span
      style={{
        color: "var(--warning)",
        backgroundColor: "color-mix(in srgb, var(--warning) 10%, #ffffff)",
      }}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
      title="Nenhum aluno matriculado nesta turma"
    >
      <UserIcon className="h-3 w-3" />
      Sem alunos
    </span>
  );
}

/** Ícone-marca da área, usado nos estados vazios. */
export function GroupsGlyph({ className }: { className?: string }) {
  return <GroupsIcon className={className} />;
}
