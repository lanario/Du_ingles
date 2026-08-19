"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CalendarIcon, GroupsIcon } from "@/components/ui/icons";
import type { GroupDetail } from "@/repositories/groups";

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function formatSchedule(schedule: GroupDetail["schedule"]): string[] {
  return schedule.map((slot) => `${WEEKDAYS[slot.weekday]} ${slot.start}–${slot.end}`);
}

export function LevelBadge({ level }: { level: string }) {
  return (
    <span className="inline-flex h-6 items-center rounded-full bg-gold-50 px-2.5 text-xs font-semibold tracking-wide text-gold-700 ring-1 ring-inset ring-gold-300/60">
      {level}
    </span>
  );
}

/**
 * Barra de lotação. A largura anima uma única vez, na entrada; depois disso
 * ela é estado, não efeito — repetir a animação a cada re-render faria a
 * barra "pular" toda vez que alguém é matriculado.
 */
function CapacityMeter({ current, max }: { current: number; max: number }) {
  const reduceMotion = useReducedMotion();
  const ratio = max > 0 ? Math.min(current / max, 1) : 0;
  const full = current >= max;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Lotação</span>
        <span
          className={cn("tabular font-medium", full ? "text-warning" : "text-navy-800")}
        >
          {current}/{max}
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-navy-100"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label="Alunos matriculados"
      >
        <motion.div
          initial={reduceMotion ? false : { scaleX: 0 }}
          animate={{ scaleX: ratio }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
          style={{ transformOrigin: "left" }}
          className={cn(
            "h-full w-full rounded-full",
            full ? "bg-warning" : "bg-navy-600",
          )}
        />
      </div>
    </div>
  );
}

export function GroupCard({
  group,
  index = 0,
  badge,
  headerAction,
  children,
}: {
  group: GroupDetail;
  index?: number;
  badge?: ReactNode;
  /** Slot fixo no canto superior direito — hoje só o botão "Editar" do admin/professor. */
  headerAction?: ReactNode;
  children?: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const slots = formatSchedule(group.schedule);

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.3), ease: "easeOut" }}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      className="rounded-2xl border border-border bg-background p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-navy-900">
              {group.name}
            </h3>
            <LevelBadge level={group.level} />
            {!group.isActive && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                inativa
              </span>
            )}
            {badge}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <GroupsIcon className="h-4 w-4 flex-none" />
            <span className="truncate">
              {group.teacherName}
              {group.courseName ? ` · ${group.courseName}` : ""}
            </span>
          </p>
        </div>
        {headerAction}
      </div>

      {slots.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {slots.map((slot) => (
            <li
              key={slot}
              className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-xs text-navy-800"
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {slot}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <CapacityMeter current={group.enrolledCount} max={group.maxStudents} />
      </div>

      {children && <div className="mt-4 border-t border-border pt-4">{children}</div>}
    </motion.article>
  );
}
