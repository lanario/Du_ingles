"use client";

/**
 * Peças do painel de detalhe — a tela que abre quando se clica num cartão de
 * lista. O container é o `SidePanel`; aqui ficam só o conteúdo padrão
 * (cabeçalho, blocos de ação, linhas de dado) e o guarda do clique que abre
 * o painel.
 *
 * Fica em `components/ui` de propósito: qualquer área de cartões (usuários,
 * turmas, ...) abre o detalhe do mesmo jeito.
 */

import type { ComponentType, MouseEvent, ReactNode } from "react";
import type { IconProps } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

type DetailIcon = ComponentType<IconProps>;

/**
 * Controles que já têm ação própria dentro do cartão: o menu "⋮", os botões
 * de copiar, os links. Clique neles não pode abrir o painel por tabela.
 */
const CONTROLS = "a, button, input, select, textarea, label, [role='menu']";

/**
 * Handler do clique no cartão. Só abre o detalhe quando o clique nasceu numa
 * área "morta" do item — nunca quando o usuário estava selecionando texto.
 */
export function onOpenClick(open: () => void) {
  return (event: MouseEvent<HTMLElement>) => {
    const target = event.target as Element | null;
    if (target?.closest?.(CONTROLS)) return;
    if (window.getSelection()?.toString().trim()) return;
    open();
  };
}

/** Corpo rolável do painel: respiro padrão entre os blocos. */
export function DetailBody({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-6 px-4 py-5 sm:px-6 sm:py-6">{children}</div>;
}

/**
 * Topo do painel: o avatar grande do registro com os selos ao lado. É o que
 * confirma, num relance, que o painel abriu no item certo.
 */
export function DetailHeader({
  avatar,
  title,
  description,
  badges,
}: {
  avatar: ReactNode;
  title: string;
  description?: ReactNode;
  badges?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-4">
      {avatar}
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold leading-snug text-admin-foreground">
          {title}
        </p>
        {description && <div className="mt-1 text-sm text-admin-foreground/60">{description}</div>}
        {badges && <div className="mt-2.5 flex flex-wrap items-center gap-1.5">{badges}</div>}
      </div>
    </div>
  );
}

/** Bloco titulado. O título é opcional — nem todo bloco precisa de rótulo. */
export function DetailSection({
  title,
  action,
  children,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      {(title || action) && (
        <div className="mb-2 flex items-center justify-between gap-3">
          {title && (
            <h3 className="text-[10px] font-medium uppercase tracking-wide text-admin-foreground/50">
              {title}
            </h3>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * Linha de dado: ícone, rótulo e valor. Com `href` o valor vira link; sem
 * valor, mostra "não informado" — a ausência do dado também é informação.
 */
export function DetailRow({
  icon: Icon,
  label,
  value,
  href,
  mono = false,
  action,
}: {
  icon: DetailIcon;
  label: string;
  value: string | null;
  href?: string;
  /** Documento, id e afins ficam em fonte monoespaçada. */
  mono?: boolean;
  action?: ReactNode;
}) {
  const external = href?.startsWith("http");

  return (
    <div className="flex items-center gap-3 border-b border-admin-border py-3 last:border-0">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-admin-muted text-admin-foreground/50">
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-wide text-admin-foreground/50">
          {label}
        </p>
        {value ? (
          href ? (
            <a
              href={href}
              target={external ? "_blank" : undefined}
              rel={external ? "noopener noreferrer" : undefined}
              className={cn(
                "block truncate text-sm text-admin-foreground transition-colors hover:text-gold-600",
                mono && "font-mono",
              )}
            >
              {value}
            </a>
          ) : (
            <p className={cn("truncate text-sm text-admin-foreground", mono && "font-mono")}>
              {value}
            </p>
          )
        ) : (
          <p className="text-sm italic text-admin-foreground/40">não informado</p>
        )}
      </div>

      {value && action}
    </div>
  );
}

/** Faixa de botões do painel — as ações que o menu "⋮" do cartão oferece. */
export function DetailActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

interface DetailButtonProps {
  icon: DetailIcon;
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  /** `accent` é a ação principal; `danger` pinta de vermelho. */
  tone?: "default" | "accent" | "danger";
}

export function DetailButton({
  icon: Icon,
  label,
  onClick,
  href,
  disabled = false,
  tone = "default",
}: DetailButtonProps) {
  const className = cn(
    "inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
    "disabled:cursor-not-allowed disabled:opacity-40",
    tone === "danger"
      ? "border-destructive/35 text-destructive hover:bg-destructive/10"
      : tone === "accent"
        ? "border-gold-400/60 text-gold-700 hover:bg-gold-50"
        : "border-admin-border text-admin-foreground hover:bg-admin-muted",
  );

  if (href) {
    return (
      <a
        href={href}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
        className={className}
      >
        <Icon className="h-4 w-4" />
        {label}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
