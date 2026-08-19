"use client";

/**
 * Menu de ações de um item de lista (o "⋮" no canto do cartão). Abre com
 * `AnimatePresence`, fecha ao clicar fora, no Esc e depois de escolher.
 *
 * As opções vêm de fora: cada tela decide o que oferece; o componente só cuida
 * do comportamento e da aparência.
 */

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MoreIcon, type IconProps } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export interface ActionMenuItem {
  label: string;
  icon: ComponentType<IconProps>;
  onSelect: () => void;
  /** `danger` pinta o item de vermelho; `accent` destaca o ícone em dourado. */
  tone?: "default" | "accent" | "danger";
  /** Desenha um separador acima deste item. */
  separated?: boolean;
  disabled?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  /** Rótulo do botão para leitores de tela. */
  label: string;
  disabled?: boolean;
  /**
   * Avisa quem contém o menu. Os cartões usam isso para subir de camada
   * enquanto ele está aberto — sem isso o vizinho da grade pinta por cima.
   */
  onOpenChange?: (open: boolean) => void;
}

export function ActionMenu({ items, label, disabled = false, onOpenChange }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const toggle = useCallback(
    (next: boolean) => {
      setOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      toggle(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") toggle(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, toggle]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => toggle(!open)}
        className={cn(
          "rounded-lg p-2 text-admin-foreground/45 transition-colors sm:p-1.5",
          "hover:bg-admin-muted hover:text-admin-foreground",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
          open && "bg-admin-muted text-admin-foreground",
          disabled && "cursor-not-allowed opacity-40",
        )}
      >
        <MoreIcon className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-full z-50 mt-1 w-56 origin-top-right overflow-hidden rounded-xl border border-admin-border bg-admin-surface p-1.5 shadow-[var(--shadow-card-hover)]"
          >
            {items.map((item) => {
              const Icon = item.icon;
              const danger = item.tone === "danger";
              return (
                <div key={item.label}>
                  {item.separated && <div className="my-1 h-px bg-admin-border" />}
                  <button
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={() => {
                      toggle(false);
                      item.onSelect();
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      "disabled:cursor-not-allowed disabled:opacity-40",
                      danger
                        ? "text-destructive hover:bg-destructive/10"
                        : "text-admin-foreground hover:bg-gold-50",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 flex-none",
                        danger
                          ? "text-destructive"
                          : item.tone === "accent"
                            ? "text-gold-600"
                            : "text-admin-foreground/45",
                      )}
                    />
                    {item.label}
                  </button>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
