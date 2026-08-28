"use client";

/**
 * Menu de ações de um item de lista (o "⋮" no canto do cartão). Abre com
 * `AnimatePresence`, fecha ao clicar fora, no Esc e depois de escolher.
 *
 * As opções vêm de fora: cada tela decide o que oferece; o componente só cuida
 * do comportamento e da aparência.
 *
 * O menu é renderizado num portal em `document.body`, posicionado via
 * `position: fixed` a partir do botão — listas costumam ficar dentro de
 * cartões com `overflow-hidden` (para arredondar as bordas), e um menu
 * absoluto ali dentro seria cortado.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MoreIcon, type IconProps } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

const MENU_WIDTH = 224; // w-56
const MENU_MARGIN = 8;

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
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => setMounted(true), []);

  const toggle = useCallback(
    (next: boolean) => {
      setOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  useLayoutEffect(() => {
    if (!open) return;

    function place() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const left = Math.min(
        Math.max(MENU_MARGIN, rect.right - MENU_WIDTH),
        window.innerWidth - MENU_WIDTH - MENU_MARGIN,
      );
      setCoords({ top: rect.bottom + 4, left });
    }

    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      toggle(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") toggle(false);
    }
    function onScroll(event: Event) {
      if (menuRef.current?.contains(event.target as Node)) return;
      toggle(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [open, toggle]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
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

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && coords && (
              <motion.div
                ref={menuRef}
                role="menu"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  position: "fixed",
                  top: coords.top,
                  left: coords.left,
                  width: MENU_WIDTH,
                }}
                className="z-50 origin-top-right overflow-hidden rounded-xl border border-admin-border bg-admin-surface p-1.5 shadow-[var(--shadow-card-hover)]"
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
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
