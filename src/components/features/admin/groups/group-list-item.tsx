"use client";

/**
 * Linha da lista de turmas — mesma informação do cartão, em formato de tabela
 * para quem prefere comparar lotação de muitas turmas de uma vez. A grade de
 * colunas (`LIST_GRID`) é compartilhada com o cabeçalho em `TurmasView`.
 */

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { motion, useReducedMotion } from "framer-motion";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { onOpenClick } from "@/components/ui/detail-panel";
import { PencilIcon, PowerIcon, UserIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { useArea } from "@/components/features/admin/area-context";
import {
  GroupStatusPill,
  LevelPill,
  OccupancyBar,
  ScheduleChips,
} from "./groups-visuals";
import type { Group } from "./groups-utils";
import { LoadingVeil } from "@/components/ui/logo-loader";

export const LIST_GRID =
  "grid grid-cols-[1.5fr_1fr_0.5fr_1fr_1.2fr_0.7fr_auto] items-center gap-3";

interface GroupListItemProps {
  group: Group;
  busy: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
}

export function GroupListItem({
  group,
  busy,
  onOpen,
  onEdit,
  onToggleActive,
}: GroupListItemProps) {
  const reduceMotion = useReducedMotion();
  const { base, canManageGroups } = useArea();
  const [menuOpen, setMenuOpen] = useState(false);

  // Arquivar tira a turma da operação da escola inteira — decisão de
  // coordenação. O professor edita a própria turma, mas não a arquiva.
  const actions: ActionMenuItem[] = [
    { label: "Ver detalhes", icon: UserIcon, onSelect: onOpen },
    { label: "Editar turma", icon: PencilIcon, tone: "accent", onSelect: onEdit },
    ...(canManageGroups
      ? [
          {
            label: group.isActive ? "Arquivar turma" : "Reativar turma",
            icon: PowerIcon,
            tone: (group.isActive ? "danger" : "accent") as ActionMenuItem["tone"],
            separated: true,
            onSelect: onToggleActive,
          },
        ]
      : []),
  ];

  return (
    <motion.div
      layout
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      onClick={onOpenClick(onOpen)}
      className={cn(
        LIST_GRID,
        "cursor-pointer border-b border-admin-border bg-admin-surface px-4 py-3 text-sm transition-colors last:border-0",
        "hover:bg-admin-muted/60",
        menuOpen && "relative z-20",
        busy && "relative pointer-events-none",
        !group.isActive && "opacity-70",
      )}
    >
      {busy && <LoadingVeil label={null} size={22} />}
      <div className="min-w-0">
        <Link
          href={`${base}/turmas/${group.id}` as Route}
          className="block max-w-full truncate font-medium text-admin-foreground transition-colors hover:text-gold-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
        >
          {group.name}
        </Link>
        <p className="truncate text-xs text-admin-foreground/50">
          {group.courseName ?? "sem curso vinculado"}
        </p>
      </div>

      <div className="min-w-0 truncate text-admin-foreground/70">{group.teacherName}</div>

      <div>
        <LevelPill level={group.level} />
      </div>

      <OccupancyBar group={group} />

      <div className="min-w-0">
        <ScheduleChips schedule={group.schedule} compact max={2} />
      </div>

      <div>
        <GroupStatusPill isActive={group.isActive} />
      </div>

      <ActionMenu
        items={actions}
        disabled={busy}
        onOpenChange={setMenuOpen}
        label={`Ações da turma ${group.name}`}
      />
    </motion.div>
  );
}
