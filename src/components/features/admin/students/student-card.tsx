"use client";

/**
 * Cartão de um aluno. Mesmo desenho do cartão de usuário (`UserCard`):
 * transform do framer-motion para layout/hover. A diferença é que este
 * cartão é arrastável — soltar sobre uma turma na `GroupsRail` matricula
 * ou transfere o aluno para lá.
 */

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarIcon, MailIcon, PowerIcon, SwapIcon, UserIcon } from "@/components/ui/icons";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { onOpenClick } from "@/components/ui/detail-panel";
import { cn } from "@/lib/utils";
import {
  CopyButton,
  PendingPasswordPill,
  StatusPill,
  UserAvatar,
  GroupPill,
  LevelPill,
} from "./students-visuals";
import { formatDate, type Student } from "./students-utils";

interface StudentCardProps {
  student: Student;
  busy: boolean;
  onOpen: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
  onMove: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export function StudentCard({
  student,
  busy,
  onOpen,
  onDeactivate,
  onReactivate,
  onMove,
  onDragStart,
  onDragEnd,
}: StudentCardProps) {
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
    <motion.article
      layout
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.8 }}
      whileHover={reduceMotion ? undefined : { y: -4 }}
      onClick={onOpenClick(onOpen)}
      // Arrastar o cartão para uma turma da barra. Os handlers `*Capture` usam
      // o DragEvent nativo — os do framer-motion são de outra gesture, que
      // aqui não está ligada.
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
      className={cn(
        "group relative flex cursor-grab flex-col rounded-2xl border p-5 transition-colors duration-300",
        "border-admin-border bg-admin-surface",
        "shadow-[0_1px_2px_rgba(11,26,51,0.04),0_10px_30px_-20px_rgba(11,26,51,0.4)]",
        "hover:border-gold-300",
        menuOpen && "z-20",
        busy && "opacity-60",
        !student.isActive && "opacity-70",
        dragging && "opacity-40",
      )}
    >
      <div className="relative flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <StatusPill isActive={student.isActive} />
          <GroupPill name={student.groupName} level={student.groupLevel} />
        </div>
        <ActionMenu items={actions} disabled={busy} onOpenChange={setMenuOpen} label={`Ações de ${student.fullName}`} />
      </div>

      <div className="relative mt-3 flex flex-col items-center text-center">
        <motion.span
          whileHover={reduceMotion ? undefined : { scale: 1.06 }}
          transition={{ type: "spring", stiffness: 400, damping: 18 }}
        >
          <UserAvatar id={student.id} name={student.fullName} />
        </motion.span>

        <h3 title={student.fullName} className="mt-3 w-full text-[15px] font-semibold leading-snug">
          <button
            type="button"
            onClick={onOpen}
            className="block max-w-full truncate text-admin-foreground transition-colors hover:text-gold-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
          >
            {student.fullName}
          </button>
        </h3>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
          <LevelPill level={student.currentLevel} />
          {student.mustChangePassword && <PendingPasswordPill />}
        </div>
      </div>

      <ul className="relative mt-4 space-y-2.5 border-t border-admin-border pt-4 text-xs">
        <li className="flex items-center gap-2.5">
          <MailIcon className="h-3.5 w-3.5 shrink-0 text-admin-foreground/40" />
          <span className="min-w-0 flex-1 truncate text-admin-foreground/60">{student.email}</span>
          <CopyButton value={student.email} label={`Copiar e-mail de ${student.fullName}`} />
        </li>
        {student.guardianName && (
          <li className="flex items-center gap-2.5">
            <UserIcon className="h-3.5 w-3.5 shrink-0 text-admin-foreground/40" />
            <span className="min-w-0 flex-1 truncate text-admin-foreground/60">
              Responsável: {student.guardianName}
            </span>
          </li>
        )}
        <li className="flex items-center gap-2.5">
          <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-admin-foreground/40" />
          <span className="min-w-0 flex-1 truncate text-admin-foreground/60">
            Aluno desde {formatDate(student.createdAt)}
          </span>
        </li>
      </ul>
    </motion.article>
  );
}
