"use client";

/**
 * Barra de filtros da área de turmas — o equivalente da `GroupsRail` da área
 * de alunos, só que os "recipientes" aqui são os professores.
 *
 * Duas faixas, na ordem em que a coordenação pensa: primeiro *de quem* é a
 * turma, depois *que nível* ela atende. A faixa de níveis só aparece quando há
 * mais de um nível em jogo — filtro que não separa nada é ruído.
 */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { GraduationIcon, GroupsIcon, UserIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { CEFR_TONE, initialsOf, toneOf, type TeacherBucket, type TeacherFilter } from "./groups-utils";
import type { CefrLevel } from "@/types/domain";

const CHIP =
  "relative flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500";

const CHIP_INACTIVE =
  "border-admin-border bg-admin-surface text-admin-foreground/60 hover:border-gold-300 hover:text-admin-foreground";

const CHIP_ACTIVE = "border-gold-500 bg-gold-50 text-admin-foreground";

interface GroupsFilterRailProps {
  teachers: TeacherBucket[];
  teacherFilter: TeacherFilter;
  onTeacherChange: (filter: TeacherFilter) => void;
  total: number;

  levels: { level: CefrLevel; count: number }[];
  levelFilter: CefrLevel | "all";
  onLevelChange: (level: CefrLevel | "all") => void;
}

export function GroupsFilterRail({
  teachers,
  teacherFilter,
  onTeacherChange,
  total,
  levels,
  levelFilter,
  onLevelChange,
}: GroupsFilterRailProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="mb-5 space-y-2">
      <div className="-mx-4 overflow-x-auto px-4 pb-1 md:-mx-6 md:px-6">
        <div className="flex w-max items-center gap-2">
          <button
            type="button"
            aria-pressed={teacherFilter.type === "all"}
            onClick={() => onTeacherChange({ type: "all" })}
            className={cn(CHIP, teacherFilter.type === "all" ? CHIP_ACTIVE : CHIP_INACTIVE)}
          >
            <GroupsIcon className="h-4 w-4 text-gold-600" />
            Todos os professores
            <Count value={total} active={teacherFilter.type === "all"} />
          </button>

          <AnimatePresence initial={false} mode="popLayout">
            {teachers.map((teacher) => {
              const active = teacherFilter.type === "teacher" && teacherFilter.id === teacher.id;
              const tone = toneOf(teacher.id || teacher.name);
              return (
                <motion.button
                  key={teacher.id}
                  type="button"
                  layout
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  aria-pressed={active}
                  onClick={() =>
                    onTeacherChange(active ? { type: "all" } : { type: "teacher", id: teacher.id })
                  }
                  className={cn(CHIP, "pl-1.5", active ? CHIP_ACTIVE : CHIP_INACTIVE)}
                >
                  <span
                    aria-hidden
                    style={{
                      color: tone,
                      backgroundColor: `color-mix(in srgb, ${tone} 12%, #ffffff)`,
                      boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone} 26%, transparent)`,
                    }}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold"
                  >
                    {initialsOf(teacher.name)}
                  </span>
                  <span className="max-w-[11rem] truncate">{teacher.name}</span>
                  <Count value={teacher.count} active={active} />
                </motion.button>
              );
            })}
          </AnimatePresence>

          {teachers.length === 0 && (
            <span className="inline-flex items-center gap-2 rounded-xl border border-dashed border-admin-border px-3 py-2 text-sm text-admin-foreground/45">
              <UserIcon className="h-4 w-4" />
              Nenhum professor com turma
            </span>
          )}
        </div>
      </div>

      {levels.length > 1 && (
        <div className="-mx-4 overflow-x-auto px-4 pb-1 md:-mx-6 md:px-6">
          <div className="flex w-max items-center gap-1.5">
            <span className="mr-1 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-admin-foreground/40">
              <GraduationIcon className="h-3.5 w-3.5" />
              Nível
            </span>

            <LevelChip
              label="Todos"
              count={levels.reduce((sum, item) => sum + item.count, 0)}
              active={levelFilter === "all"}
              onClick={() => onLevelChange("all")}
            />

            {levels.map(({ level, count }) => (
              <LevelChip
                key={level}
                label={level}
                count={count}
                tone={CEFR_TONE[level]}
                active={levelFilter === level}
                onClick={() => onLevelChange(levelFilter === level ? "all" : level)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LevelChip({
  label,
  count,
  tone,
  active,
  onClick,
}: {
  label: string;
  count: number;
  tone?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={
        active && tone
          ? {
              color: tone,
              backgroundColor: `color-mix(in srgb, ${tone} 10%, #ffffff)`,
              boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone} 40%, transparent)`,
            }
          : undefined
      }
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
        active && !tone
          ? "bg-gold-50 text-admin-foreground shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--gold-500)_40%,transparent)]"
          : !active &&
              "border border-admin-border bg-admin-surface text-admin-foreground/55 hover:border-gold-300 hover:text-admin-foreground",
      )}
    >
      {label}
      <span className="text-[10px] tabular opacity-60">{count}</span>
    </button>
  );
}

function Count({ value, active }: { value: number; active: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-1.5 text-[10px] font-semibold tabular",
        active ? "bg-gold-100 text-gold-700" : "bg-admin-muted text-admin-foreground/50",
      )}
    >
      {value}
    </span>
  );
}
