"use client";

/**
 * Cartão de uma turma. Mesmo desenho dos cartões de usuário e aluno (framer
 * motion para layout/hover, `ActionMenu` no canto), com o anel de lotação no
 * lugar do avatar — numa lista de turmas o que se procura é ocupação, não
 * rosto.
 *
 * O véu dourado do hover (`tone-glow`) é tingido pelo tom da lotação: uma
 * turma lotada acende verde, uma enchendo acende dourado. O efeito é o mesmo
 * do resto do painel; só a cor conta a história.
 */

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { onOpenClick } from "@/components/ui/detail-panel";
import { CalendarIcon, PencilIcon, PowerIcon, UserIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import {
  CoursePill,
  EmptyGroupPill,
  GroupStatusPill,
  LevelPill,
  OccupancyRing,
  ScheduleChips,
  TeacherPill,
} from "./groups-visuals";
import { occupancyLabel, occupancyTone, periodLabel, type Group } from "./groups-utils";

interface GroupCardProps {
  group: Group;
  busy: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
}

export function GroupCard({ group, busy, onOpen, onEdit, onToggleActive }: GroupCardProps) {
  const reduceMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const tone = occupancyTone(group);
  const period = periodLabel(group);

  const actions: ActionMenuItem[] = [
    { label: "Ver detalhes", icon: UserIcon, onSelect: onOpen },
    { label: "Editar turma", icon: PencilIcon, tone: "accent", onSelect: onEdit },
    {
      label: group.isActive ? "Arquivar turma" : "Reativar turma",
      icon: PowerIcon,
      tone: group.isActive ? "danger" : "accent",
      separated: true,
      onSelect: onToggleActive,
    },
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
      style={{ ["--tone" as string]: tone }}
      className={cn(
        "group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border p-5 transition-colors duration-300",
        "border-admin-border bg-admin-surface",
        "shadow-[0_1px_2px_rgba(11,26,51,0.04),0_10px_30px_-20px_rgba(11,26,51,0.4)]",
        "hover:border-gold-300",
        menuOpen && "z-20",
        busy && "opacity-60",
        !group.isActive && "opacity-75",
      )}
    >
      <span
        aria-hidden
        className="tone-glow pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
      />

      <div className="relative flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <GroupStatusPill isActive={group.isActive} />
          <LevelPill level={group.level} />
        </div>
        <ActionMenu
          items={actions}
          disabled={busy}
          onOpenChange={setMenuOpen}
          label={`Ações da turma ${group.name}`}
        />
      </div>

      <div className="relative mt-4 flex items-center gap-4">
        <motion.span
          whileHover={reduceMotion ? undefined : { scale: 1.05 }}
          transition={{ type: "spring", stiffness: 400, damping: 18 }}
        >
          <OccupancyRing group={group} />
        </motion.span>

        <div className="min-w-0 flex-1">
          <h3 title={group.name} className="text-[15px] font-semibold leading-snug">
            <Link
              href={`/admin/turmas/${group.id}`}
              className="block max-w-full truncate text-admin-foreground transition-colors hover:text-gold-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
            >
              {group.name}
            </Link>
          </h3>

          <p className="mt-1 text-xs font-medium" style={{ color: tone }}>
            {occupancyLabel(group)}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <TeacherPill id={group.teacherId} name={group.teacherName} />
            {group.enrolledCount === 0 && group.isActive && <EmptyGroupPill />}
          </div>
        </div>
      </div>

      <div className="relative mt-4 space-y-2.5 border-t border-admin-border pt-4">
        <ScheduleChips schedule={group.schedule} max={3} />
        <div className="flex flex-wrap items-center gap-2">
          <CoursePill name={group.courseName} />
          {period && (
            <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] text-admin-foreground/50">
              <CalendarIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">{period}</span>
            </span>
          )}
        </div>
      </div>
    </motion.article>
  );
}
