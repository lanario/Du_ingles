"use client";

/**
 * Peças visuais reaproveitadas pelos cartões de usuário: avatar com as
 * iniciais no tom da pessoa, selo de papel, selo de status e o botão que copia
 * um valor.
 *
 * Todas as cores saem de `color-mix` sobre um único tom — assim um papel novo
 * (ou um tom novo de avatar) entra sem escrever variante de Tailwind nenhuma.
 */

import { useEffect, useRef, useState, type ComponentType } from "react";
import {
  CheckIcon,
  CopyIcon,
  GraduationIcon,
  ShieldIcon,
  UserIcon,
  type IconProps,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { ROLE_LABEL, ROLE_TONE, initialsOf, toneOf } from "./users-utils";
import type { AppRole } from "@/types/domain";

interface AvatarProps {
  /** Chave estável do tom (id do usuário). */
  id: string;
  /** Nome ou e-mail de onde saem as iniciais. */
  name: string;
  /** `md` no cartão, `sm` em listas compactas. */
  size?: "sm" | "md";
  className?: string;
}

export function UserAvatar({ id, name, size = "md", className }: AvatarProps) {
  const tone = toneOf(id);

  return (
    <span
      aria-hidden
      style={{
        color: tone,
        backgroundColor: `color-mix(in srgb, ${tone} 10%, #ffffff)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone} 26%, transparent)`,
      }}
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold tracking-wide",
        size === "md" ? "h-14 w-14 text-lg" : "h-9 w-9 text-xs",
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

export function RolePill({ role, className }: { role: AppRole; className?: string }) {
  const Icon = ROLE_ICON[role];
  const tone = ROLE_TONE[role];

  return (
    <span
      style={{
        color: tone,
        backgroundColor: `color-mix(in srgb, ${tone} 8%, #ffffff)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone} 22%, transparent)`,
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {ROLE_LABEL[role]}
    </span>
  );
}

export function StatusPill({ isActive }: { isActive: boolean }) {
  const tone = isActive ? "var(--success)" : "var(--muted-foreground)";

  return (
    <span
      style={{ color: tone, backgroundColor: `color-mix(in srgb, ${tone} 10%, #ffffff)` }}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tone }} />
      {isActive ? "Ativo" : "Inativo"}
    </span>
  );
}

/** Marca discreta para quem ainda não trocou a senha provisória. */
export function PendingPasswordPill() {
  return (
    <span
      style={{
        color: "var(--warning)",
        backgroundColor: "color-mix(in srgb, var(--warning) 10%, #ffffff)",
      }}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
      title="O usuário ainda usa a senha provisória do cadastro"
    >
      Senha provisória
    </span>
  );
}

/** Copia um valor para a área de transferência e confirma por 1,6 s. */
export function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Sem permissão de clipboard: nada a fazer, o valor continua visível.
    }
  }

  const Icon = copied ? CheckIcon : CopyIcon;

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      title={label}
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors sm:h-7 sm:w-7",
        copied
          ? "border-success text-success"
          : "border-admin-border text-admin-foreground/45 hover:border-gold-400 hover:text-gold-600",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
