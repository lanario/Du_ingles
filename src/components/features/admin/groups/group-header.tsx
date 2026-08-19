"use client";

/**
 * Cabeçalho da página de uma turma. É a mesma leitura do cartão da lista —
 * anel de lotação, selos, grade — só que em escala de página e com a volta
 * para a lista.
 *
 * Cliente por causa do anel (framer-motion) e do menu de ações; os dados
 * continuam vindo do servidor, prontos.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { setGroupActiveAction } from "@/actions/admin/groups";
import { ChevronIcon, PencilIcon, PowerIcon, SpinnerIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { EditGroupPanel } from "./edit-group-panel";
import {
  CoursePill,
  GroupStatusPill,
  LevelPill,
  OccupancyRing,
  ScheduleChips,
  TeacherPill,
} from "./groups-visuals";
import {
  formatMinutes,
  occupancyLabel,
  occupancyTone,
  periodLabel,
  weeklyMinutes,
  type Group,
} from "./groups-utils";
import type { Course } from "@/repositories/courses";
import type { UserListItem } from "@/repositories/users";

export function GroupHeader({
  group,
  courses,
  teachers,
}: {
  group: Group;
  courses: Course[];
  teachers: UserListItem[];
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tone = occupancyTone(group);
  const period = periodLabel(group);

  async function toggleActive() {
    setError(null);
    setBusy(true);
    try {
      const result = await setGroupActiveAction(group.id, !group.isActive);
      if (!result.success) setError(result.error.message);
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <header>
      <Link
        href="/admin/turmas"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-admin-foreground/50 transition-colors hover:text-gold-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
      >
        <ChevronIcon className="h-3.5 w-3.5 rotate-180" />
        Todas as turmas
      </Link>

      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        style={{ ["--tone" as string]: tone }}
        className={cn(
          "relative mt-3 overflow-hidden rounded-2xl border border-admin-border bg-admin-surface p-5 sm:p-6",
          "shadow-[0_1px_2px_rgba(11,26,51,0.04),0_10px_30px_-20px_rgba(11,26,51,0.4)]",
        )}
      >
        <span aria-hidden className="tone-glow pointer-events-none absolute inset-0" />

        <div className="relative flex flex-wrap items-start gap-5">
          <OccupancyRing group={group} size={96} />

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold text-admin-foreground">{group.name}</h1>
            <p className="mt-1 text-sm font-medium" style={{ color: tone }}>
              {occupancyLabel(group)} · {group.enrolledCount} de {group.maxStudents} lugares
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <GroupStatusPill isActive={group.isActive} />
              <LevelPill level={group.level} />
              <TeacherPill id={group.teacherId} name={group.teacherName} />
              <CoursePill name={group.courseName} />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-gold-400/60 px-3.5 text-sm font-medium text-gold-700 transition-colors hover:bg-gold-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
            >
              <PencilIcon className="h-4 w-4" />
              Editar
            </button>
            <button
              type="button"
              onClick={toggleActive}
              disabled={busy}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 disabled:opacity-50",
                group.isActive
                  ? "border-destructive/35 text-destructive hover:bg-destructive/10"
                  : "border-admin-border text-admin-foreground/70 hover:bg-admin-muted",
              )}
            >
              {busy ? (
                <SpinnerIcon className="h-4 w-4 animate-spin" />
              ) : (
                <PowerIcon className="h-4 w-4" />
              )}
              {group.isActive ? "Arquivar" : "Reativar"}
            </button>
          </div>
        </div>

        <div className="relative mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-admin-border pt-4">
          <ScheduleChips schedule={group.schedule} />
          <span className="text-[11px] text-admin-foreground/45">
            {formatMinutes(weeklyMinutes(group.schedule))} por semana
          </span>
          {period && <span className="text-[11px] text-admin-foreground/45">{period}</span>}
        </div>

        {error && (
          <p role="alert" className="relative mt-4 text-sm text-destructive">
            {error}
          </p>
        )}
      </motion.div>

      <EditGroupPanel
        open={editing}
        onClose={() => setEditing(false)}
        group={group}
        courses={courses}
        teachers={teachers}
      />
    </header>
  );
}
