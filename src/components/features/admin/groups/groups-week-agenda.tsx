"use client";

/**
 * Grade semanal das turmas — a mesma grade que a `ScheduleBuilder` escreve,
 * lida de volta em formato de agenda: uma coluna por dia, um cartão por
 * horário, com quem está matriculado naquele horário. Não tem data real (não
 * é uma agenda de sessões), é o *padrão* semanal que gera as sessões.
 *
 * Cada turma pode aparecer em várias colunas — uma por entrada da própria
 * grade — porque é assim que o resto da área de turmas já entende horário
 * (`ScheduleChips`, `GroupDetailPanel`): uma turma, várias entradas.
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { removeScheduleEntryAction } from "@/actions/admin/groups";
import { CalendarIcon, GraduationIcon, PencilIcon, SpinnerIcon, TrashIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { WEEKDAY_LONG, type Group } from "./groups-utils";
import type { EnrollmentListItem } from "@/repositories/enrollments";
import type { ScheduleEntry } from "@/schemas/groups";

/** Segunda a domingo, como o resto da grade da escola — semana começa em sala de aula, não no calendário ISO. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const MAX_ROSTER_SHOWN = 4;

function weekdayLabel(day: number): string {
  if (day === 0) return "Domingo";
  if (day === 6) return "Sábado";
  return `${WEEKDAY_LONG[day]}-feira`;
}

interface Slot {
  group: Group;
  entry: ScheduleEntry;
}

function nowSlot(): { weekday: number; minutes: number } {
  const now = new Date();
  return { weekday: now.getDay(), minutes: now.getHours() * 60 + now.getMinutes() };
}

function toMinutes(time: string): number {
  const [h = 0, m = 0] = time.split(":").map(Number);
  return h * 60 + m;
}

interface GroupsWeekAgendaProps {
  groups: Group[];
  rosters: Record<string, EnrollmentListItem[]>;
  onEdit: (group: Group) => void;
}

export function GroupsWeekAgenda({ groups, rosters, onEdit }: GroupsWeekAgendaProps) {
  const current = nowSlot();

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {WEEK_ORDER.map((day) => {
        const slots: Slot[] = groups
          .flatMap((group) => group.schedule.filter((entry) => entry.weekday === day).map((entry) => ({ group, entry })))
          .sort((a, b) => a.entry.start.localeCompare(b.entry.start));

        return (
          <div key={day} className="flex w-64 shrink-0 flex-col">
            <div className="flex items-center gap-2 rounded-t-2xl border border-b-0 border-admin-border bg-admin-surface px-3.5 py-3">
              <CalendarIcon className="h-4 w-4 text-admin-foreground/50" />
              <h3 className="text-sm font-semibold text-admin-foreground">{weekdayLabel(day)}</h3>
            </div>

            <div className="flex-1 space-y-2.5 rounded-b-2xl border border-admin-border bg-admin-background/40 p-2.5">
              {slots.length === 0 ? (
                <p className="rounded-xl border border-dashed border-admin-border px-3 py-6 text-center text-xs italic text-admin-foreground/40">
                  Sem aulas
                </p>
              ) : (
                <AnimatePresence initial={false}>
                  {slots.map((slot) => (
                    <SlotCard
                      key={`${slot.group.id}-${slot.entry.weekday}-${slot.entry.start}`}
                      slot={slot}
                      roster={rosters[slot.group.id] ?? []}
                      onEdit={() => onEdit(slot.group)}
                      isNow={
                        day === current.weekday &&
                        toMinutes(slot.entry.start) <= current.minutes &&
                        current.minutes < toMinutes(slot.entry.end)
                      }
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SlotCard({
  slot,
  roster,
  onEdit,
  isNow,
}: {
  slot: Slot;
  roster: EnrollmentListItem[];
  onEdit: () => void;
  isNow: boolean;
}) {
  const { group, entry } = slot;
  const reduceMotion = useReducedMotion();
  const [isRemoving, startRemove] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const active = roster.filter((item) => item.status === "active");
  const shown = active.slice(0, MAX_ROSTER_SHOWN);
  const hidden = active.length - shown.length;
  const canRemove = group.schedule.length > 1;

  function remove() {
    setError(null);
    startRemove(async () => {
      const result = await removeScheduleEntryAction(group.id, {
        weekday: entry.weekday,
        start: entry.start,
        end: entry.end,
      });
      if (!result.success) setError(result.error.message);
    });
  }

  return (
    <motion.div
      layout
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "relative rounded-xl border p-3 text-sm transition-colors",
        isNow ? "border-gold-300 bg-gold-50/60" : "border-admin-border bg-admin-surface",
        isRemoving && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="tabular text-xs font-medium text-admin-foreground/55">
          {entry.start} — {entry.end}
        </p>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Editar ${group.name}`}
            className="rounded-md p-1 text-admin-foreground/35 transition-colors hover:bg-admin-muted hover:text-admin-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
          >
            <PencilIcon className="h-3.5 w-3.5" />
          </button>
          {canRemove && (
            <button
              type="button"
              onClick={remove}
              disabled={isRemoving}
              aria-label={`Remover este horário de ${group.name}`}
              title={`Remover ${weekdayLabel(entry.weekday)} ${entry.start}–${entry.end}`}
              className="rounded-md p-1 text-admin-foreground/35 transition-colors hover:bg-destructive/10 hover:text-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 disabled:pointer-events-none disabled:opacity-50"
            >
              {isRemoving ? (
                <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <TrashIcon className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      <Link
        href={`/admin/turmas/${group.id}`}
        className="mt-1 block truncate text-sm font-semibold text-admin-foreground transition-colors hover:text-gold-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
      >
        {group.name}
      </Link>
      <p className="truncate text-xs text-admin-foreground/50">
        {group.courseName ?? `Curso de Inglês ${group.level}`}
      </p>

      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}

      {active.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-admin-border pt-2">
          {shown.map((student) => (
            <li
              key={student.id}
              className="flex items-center gap-1.5 truncate text-xs text-gold-700"
            >
              <GraduationIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">{student.studentName}</span>
            </li>
          ))}
          {hidden > 0 && (
            <li className="text-xs text-admin-foreground/45">+{hidden} aluno{hidden === 1 ? "" : "s"}</li>
          )}
        </ul>
      )}
    </motion.div>
  );
}
