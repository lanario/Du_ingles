"use client";

/**
 * Linha da lista de alunos — mesma informação do cartão, em formato de
 * tabela para quem prefere escanear muitos nomes de uma vez. A grade de
 * colunas (`LIST_GRID`) é compartilhada com o cabeçalho em `StudentsView`.
 */

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarIcon, PowerIcon, SwapIcon, UserIcon } from "@/components/ui/icons";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { onOpenClick } from "@/components/ui/detail-panel";
import { cn } from "@/lib/utils";
import { GroupPill, LevelPill, StatusPill, UserAvatar } from "./students-visuals";
import { formatDate, type Student } from "./students-utils";

export const LIST_GRID =
  "grid grid-cols-[1.6fr_1fr_0.7fr_0.8fr_1fr_auto] items-center gap-3";

interface StudentListItemProps {
  student: Student;
  busy: boolean;
  onOpen: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
  onMove: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export function StudentListItem({
  student,
  busy,
  onOpen,
  onDeactivate,
  onReactivate,
  onMove,
  onDragStart,
  onDragEnd,
}: StudentListItemProps) {
  const reduceMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragging, setDragging] = useState(false);

  const actions: ActionMenuItem[] = [
    { label: "Ver detalhes", icon: UserIcon, onSelect: onOpen },
    { label: "Mover de turma", icon: SwapIcon, tone: "accent", separated: true, onSelect: onMove },
    student.isActive
      ? { label: "Desativar", icon: PowerIcon, tone: "danger", onSelect: onDeactivate }
      : { label: "Reativar", icon: PowerIcon, tone: "accent", onSelect: onReactivate },
  ];

  return (
    <motion.div
      layout
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      draggable
      onDragStartCapture={(event) => {
        event.dataTransfer.setData("text/plain", student.id);
        event.dataTransfer.effectAllowed = "move";
        setDragging(true);
        onDragStart?.();
      }}
      onDragEndCapture={() => {
        setDragging(false);
        onDragEnd?.();
      }}
      onClick={onOpenClick(onOpen)}
      className={cn(
        LIST_GRID,
        "cursor-grab border-b border-admin-border bg-admin-surface px-4 py-3 text-sm transition-colors last:border-0",
        "hover:bg-admin-muted/60",
        menuOpen && "relative z-20",
        busy && "opacity-60",
        !student.isActive && "opacity-70",
        dragging && "opacity-40",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar id={student.id} name={student.fullName} size="sm" />
        <div className="min-w-0">
          <button
            type="button"
            onClick={onOpen}
            className="block max-w-full truncate text-left font-medium text-admin-foreground transition-colors hover:text-gold-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
          >
            {student.fullName}
          </button>
          <p className="truncate text-xs text-admin-foreground/50">{student.email}</p>
        </div>
      </div>

      <div className="min-w-0">
        <GroupPill name={student.groupName} level={student.groupLevel} />
      </div>

      <div>
        <LevelPill level={student.currentLevel} />
      </div>

      <div>
        <StatusPill isActive={student.isActive} />
      </div>

      <div className="flex items-center gap-1.5 text-xs text-admin-foreground/50">
        <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
        {formatDate(student.createdAt)}
      </div>

      <ActionMenu items={actions} disabled={busy} onOpenChange={setMenuOpen} label={`Ações de ${student.fullName}`} />
    </motion.div>
  );
}
