"use client";

/**
 * Barra de turmas da lista de alunos. Cada turma é um botão que filtra a
 * lista; soltar um cartão de aluno arrastado sobre uma turma o matricula ou
 * transfere para lá — ver `moveStudentToGroupAction`.
 *
 * Ao contrário das pastas de clientes do modelo de referência, turmas não se
 * criam, renomeiam ou apagam por aqui: são geridas em `/admin/turmas`, que já
 * cuida de horário, professor e lotação. Esta barra é só navegação e alvo de
 * arraste.
 */

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { GroupsIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { GroupListItem } from "@/repositories/groups";
import type { GroupFilter } from "./students-utils";

interface GroupsRailProps {
  groups: GroupListItem[];
  filter: GroupFilter;
  onFilterChange: (filter: GroupFilter) => void;
  /** Quantos alunos estão sem matrícula ativa. */
  unassigned: number;
  total: number;
  /** Há um cartão sendo arrastado agora — habilita os alvos de soltura. */
  dragging?: boolean;
  /** Soltou um aluno numa turma (`null` = tira da turma). */
  onDropOnGroup?: (studentId: string, groupId: string | null) => void;
}

const CHIP =
  "group/chip relative flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500";

const CHIP_INACTIVE =
  "border-admin-border bg-admin-surface text-admin-foreground/60 hover:border-gold-300 hover:text-admin-foreground";

const CHIP_ACTIVE = "border-gold-500 bg-gold-50 text-admin-foreground";

/** Turma iluminada porque o aluno arrastado está pairando sobre ela. */
const CHIP_TARGET = "border-gold-500 bg-gold-100 text-admin-foreground ring-2 ring-gold-500 scale-105";

export function GroupsRail({
  groups,
  filter,
  onFilterChange,
  unassigned,
  total,
  dragging = false,
  onDropOnGroup,
}: GroupsRailProps) {
  const reduceMotion = useReducedMotion();
  /** Chave da turma sob o cursor durante o arraste ("sem-turma" ou o id). */
  const [target, setTarget] = useState<string | null>(null);

  function dropProps(key: string, groupId: string | null) {
    if (!dragging || !onDropOnGroup) return {};
    return {
      onDragOver: (event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      },
      onDragEnter: () => setTarget(key),
      onDragLeave: (event: React.DragEvent) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setTarget((current) => (current === key ? null : current));
        }
      },
      onDrop: (event: React.DragEvent) => {
        event.preventDefault();
        const studentId = event.dataTransfer.getData("text/plain");
        setTarget(null);
        if (studentId) onDropOnGroup(studentId, groupId);
      },
    };
  }

  return (
    <div className="mb-5 -mx-4 overflow-x-auto px-4 pb-1 md:-mx-6 md:px-6">
      <div className="flex w-max items-center gap-2">
        <button
          type="button"
          aria-pressed={filter.type === "all"}
          onClick={() => onFilterChange({ type: "all" })}
          className={cn(CHIP, filter.type === "all" ? CHIP_ACTIVE : CHIP_INACTIVE)}
        >
          <GroupsIcon className="h-4 w-4 text-gold-600" />
          Todas as turmas
          <Count value={total} active={filter.type === "all"} />
        </button>

        <AnimatePresence initial={false} mode="popLayout">
          {groups.map((group) => {
            const active = filter.type === "group" && filter.id === group.id;
            return (
              <motion.div
                key={group.id}
                layout
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                {...dropProps(group.id, group.id)}
                className={cn(
                  CHIP,
                  target === group.id ? CHIP_TARGET : active ? CHIP_ACTIVE : CHIP_INACTIVE,
                  !group.isActive && "opacity-60",
                )}
              >
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onFilterChange(active ? { type: "all" } : { type: "group", id: group.id })}
                  className="-my-2 flex items-center gap-2 py-2 focus:outline-none"
                >
                  <GroupsIcon
                    className={cn("h-4 w-4", active ? "text-gold-600" : "text-admin-foreground/40")}
                  />
                  <span className="max-w-[10rem] truncate">{group.name}</span>
                  <span className="text-[10px] text-admin-foreground/40">{group.level}</span>
                  <Count value={group.enrolledCount} active={active} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {(unassigned > 0 || dragging) && (
          <button
            type="button"
            aria-pressed={filter.type === "none"}
            onClick={() => onFilterChange(filter.type === "none" ? { type: "all" } : { type: "none" })}
            {...dropProps("sem-turma", null)}
            className={cn(
              CHIP,
              "border-dashed",
              target === "sem-turma" ? CHIP_TARGET : filter.type === "none" ? CHIP_ACTIVE : CHIP_INACTIVE,
            )}
          >
            <GroupsIcon className="h-4 w-4 opacity-50" />
            Sem turma
            <Count value={unassigned} active={filter.type === "none"} />
          </button>
        )}
      </div>
    </div>
  );
}

function Count({ value, active }: { value: number; active: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
        active ? "bg-gold-200/70 text-gold-800" : "bg-admin-muted text-admin-foreground/50",
      )}
    >
      {value}
    </span>
  );
}
