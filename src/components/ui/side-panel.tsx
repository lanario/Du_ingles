"use client";

/**
 * Painel lateral genérico que desliza da direita — overlay com blur e o
 * painel com `translate-x`. Não é específico de nenhum domínio: serve para
 * qualquer detalhe ou formulário que precise abrir sem sair da lista.
 */

import { useEffect, useId, useRef, type ReactNode } from "react";
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

export function SidePanel({
  open,
  onClose,
  title,
  subtitle,
  children,
  wide = false,
}: SidePanelProps) {
  const titleId = useId();
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Mesmo contrato do `Dialog`: foco inicial dentro do painel, Tab preso nele e
  // foco devolvido a quem o abriu. `onClose` fica em ref para o painel não
  // roubar o foco de volta a cada re-render do pai.
  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const focusable = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    (
      panelRef.current?.querySelector<HTMLElement>("[data-autofocus]") ?? focusable()[0]
    )?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open]);

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
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={reduceMotion ? { opacity: 0 } : { x: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            className={[
              "fixed right-0 top-0 bottom-0 z-50 flex max-h-[100dvh] flex-col border-l border-admin-border bg-admin-surface shadow-2xl",
              wide
                ? "w-full sm:w-[600px] sm:max-w-xl"
                : "w-full sm:w-[440px] sm:max-w-md",
            ].join(" ")}
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-admin-border px-4 py-4 sm:px-6 sm:py-5">
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className="truncate text-xl font-bold text-admin-foreground"
                >
                  {title}
                </h2>
                {subtitle && (
                  <p className="mt-1 text-sm text-admin-foreground/60">{subtitle}</p>
                )}
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

            {/* `overscroll-contain` impede que o toque, ao chegar no fim do
                painel, continue rolando a pagina atras dele — no mobile o
                painel ocupa a tela inteira e esse encadeamento parece bug.
                O padding inferior reserva a barra de gestos do iOS. */}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom,0px)]">
              {children}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
