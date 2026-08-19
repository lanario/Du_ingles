"use client";

/**
 * Peças visuais específicas do domínio de alunos: o selo de nível CEFR e o
 * selo de turma. Avatar, selo de status e botão de copiar vêm de
 * `users-visuals` — a mesma linguagem visual da área de Usuários, sem
 * duplicar.
 */

import { GraduationIcon, GroupsIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { CEFR_TONE } from "./students-utils";
import type { CefrLevel } from "@/types/domain";

export {
  CopyButton,
  PendingPasswordPill,
  StatusPill,
  UserAvatar,
} from "@/components/features/admin/users/users-visuals";

export function LevelPill({ level, className }: { level: CefrLevel; className?: string }) {
  const tone = CEFR_TONE[level];

  return (
    <span
      style={{
        color: tone,
        backgroundColor: `color-mix(in srgb, ${tone} 8%, #ffffff)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone} 24%, transparent)`,
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
        className,
      )}
    >
      <GraduationIcon className="h-3 w-3" />
      {level}
    </span>
  );
}

export function GroupPill({
  name,
  level,
  className,
}: {
  name: string | null;
  level?: CefrLevel | null;
  className?: string;
}) {
  if (!name) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-dashed border-admin-border px-2.5 py-1 text-[11px] text-admin-foreground/40",
          className,
        )}
      >
        <GroupsIcon className="h-3 w-3" />
        Sem turma
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
      <GroupsIcon className="h-3 w-3 shrink-0 text-gold-600" />
      <span className="max-w-[9rem] truncate">{name}</span>
      {level && <span className="text-admin-foreground/40">· {level}</span>}
    </span>
  );
}
