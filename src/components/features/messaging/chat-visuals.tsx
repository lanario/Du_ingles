"use client";

/**
 * Peças visuais do chat. Nada aqui guarda estado — são selos, avatares e
 * emblemas que a lista, o cabeçalho e a thread reaproveitam para falar a
 * mesma língua: nível da turma em azul→dourado, papel de quem escreve no tom
 * já usado nas telas de Usuários.
 */

import { motion, useReducedMotion } from "framer-motion";
import {
  GraduationIcon,
  GroupsIcon,
  type IconProps,
  LockIcon,
  ShieldIcon,
  UnlockIcon,
  UserIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { CEFR_TONE, ROLE_TONE, initialsOf, toneOf } from "./chat-utils";
import type { AppRole, CefrLevel } from "@/types/domain";
import type { ComponentType } from "react";

/**
 * Emblema da turma. O nível não é só um selo ao lado do nome: ele tinge o
 * próprio avatar, então a lista inteira se lê por cor antes de se ler por
 * texto — A1 no azul mais claro, C2 no dourado.
 */
export function GroupGlyph({
  name,
  level,
  size = "md",
  muted,
  className,
}: {
  name: string;
  level: CefrLevel;
  size?: "sm" | "md" | "lg";
  muted?: boolean;
  className?: string;
}) {
  const tone = CEFR_TONE[level];

  return (
    <span
      aria-hidden
      style={{
        color: tone,
        backgroundColor: `color-mix(in srgb, ${tone} ${muted ? 6 : 12}%, #ffffff)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone} ${muted ? 14 : 28}%, transparent)`,
      }}
      className={cn(
        "relative grid shrink-0 place-items-center rounded-2xl font-semibold tracking-wide",
        size === "lg" && "h-12 w-12 text-sm",
        size === "md" && "h-11 w-11 text-[13px]",
        size === "sm" && "h-9 w-9 text-[11px]",
        muted && "opacity-70",
        className,
      )}
    >
      {initialsOf(name)}
      <span
        style={{ backgroundColor: tone }}
        className={cn(
          "absolute -bottom-1 -right-1 rounded-full px-1.5 py-px text-[9px] font-bold leading-tight text-white",
          "shadow-[0_0_0_2px_var(--background)]",
          size === "sm" && "px-1 text-[8px]",
        )}
      >
        {level}
      </span>
    </span>
  );
}

/** Avatar de quem escreve. Cor derivada do id — estável entre sessões. */
export function SenderAvatar({
  id,
  name,
  size = "sm",
  className,
}: {
  id: string;
  name: string;
  size?: "xs" | "sm";
  className?: string;
}) {
  const tone = toneOf(id);

  return (
    <span
      aria-hidden
      style={{
        color: tone,
        backgroundColor: `color-mix(in srgb, ${tone} 12%, #ffffff)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone} 26%, transparent)`,
      }}
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold",
        size === "sm" ? "h-8 w-8 text-[11px]" : "h-6 w-6 text-[9px]",
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

const ROLE_ICON: Record<AppRole, ComponentType<IconProps>> = {
  admin: ShieldIcon,
  teacher: GraduationIcon,
  student: UserIcon,
};

const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Coordenação",
  teacher: "Professor",
  student: "Aluno",
};

/** Selo de autoridade. Só aparece para quem *não* é aluno — no chat de turma
 * a informação útil é "isto veio do professor", não "isto veio de um aluno". */
export function AuthorTag({ role, className }: { role: AppRole; className?: string }) {
  if (role === "student") return null;
  const Icon = ROLE_ICON[role];
  const tone = ROLE_TONE[role];

  return (
    <span
      style={{
        color: tone,
        backgroundColor: `color-mix(in srgb, ${tone} 9%, #ffffff)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone} 22%, transparent)`,
      }}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-medium",
        className,
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {ROLE_LABEL[role]}
    </span>
  );
}

export function MemberRoleTag({ role }: { role: AppRole }) {
  const Icon = ROLE_ICON[role];
  const tone = ROLE_TONE[role];

  return (
    <span style={{ color: tone }} className="inline-flex items-center gap-1 text-[11px]">
      <Icon className="h-3 w-3" />
      {ROLE_LABEL[role]}
    </span>
  );
}

/** Estado da trava, em uma peça só — cadeado + frase, aberto ou fechado. */
export function PostingPill({
  open,
  compact,
  className,
}: {
  open: boolean;
  compact?: boolean;
  className?: string;
}) {
  const tone = open ? "var(--success)" : "var(--warning)";
  const Icon = open ? UnlockIcon : LockIcon;

  return (
    <span
      style={{
        color: tone,
        backgroundColor: `color-mix(in srgb, ${tone} 8%, #ffffff)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone} 22%, transparent)`,
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium",
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {!compact && (open ? "Alunos podem escrever" : "Somente avisos")}
    </span>
  );
}

/** Contagem de não lidas. Some sozinha em zero — nada de badge com "0". */
export function UnreadBadge({ count }: { count: number }) {
  const reduceMotion = useReducedMotion();
  if (count <= 0) return null;

  return (
    <motion.span
      initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 520, damping: 26 }}
      className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-bold tabular text-primary-foreground"
    >
      {count > 99 ? "99+" : count}
    </motion.span>
  );
}

export function MemberCount({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <GroupsIcon className="h-3.5 w-3.5" />
      <span className="tabular">{count}</span>
      {count === 1 ? "participante" : "participantes"}
    </span>
  );
}
