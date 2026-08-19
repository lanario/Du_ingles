"use client";

/**
 * Painel lateral genérico que desliza da direita — overlay com blur e o
 * painel com `translate-x`. Não é específico de nenhum domínio: serve para
 * qualquer detalhe ou formulário que precise abrir sem sair da lista.
 */

import { useEffect, useId, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CloseIcon } from "@/components/ui/icons";

export interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Painel largo (600px) em vez do padrão (420px). */
  wide?: boolean;
}

export function SidePanel({ open, onClose, title, subtitle, children, wide = false }: SidePanelProps) {
  const titleId = useId();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            role="presentation"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-navy-950/45 backdrop-blur-[3px]"
          />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={reduceMotion ? { opacity: 0 } : { x: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            className={[
              "fixed right-0 top-0 bottom-0 z-50 flex max-h-[100dvh] flex-col border-l border-admin-border bg-admin-surface shadow-2xl",
              wide ? "w-full sm:w-[600px] sm:max-w-xl" : "w-full sm:w-[440px] sm:max-w-md",
            ].join(" ")}
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-admin-border px-4 py-4 sm:px-6 sm:py-5">
              <div className="min-w-0">
                <h2 id={titleId} className="truncate text-xl font-bold text-admin-foreground">
                  {title}
                </h2>
                {subtitle && <p className="mt-1 text-sm text-admin-foreground/60">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="-mr-1 rounded-lg p-2 text-admin-foreground/50 transition-colors hover:bg-admin-muted hover:text-admin-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
