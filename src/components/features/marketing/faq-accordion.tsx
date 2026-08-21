"use client";

/**
 * Acordeão das dúvidas que aparecem ao lado do formulário da aula
 * experimental. Uma pergunta aberta por vez: a coluna é estreita e duas
 * respostas abertas empurrariam o formulário para fora da dobra.
 *
 * A altura é animada pelo Framer (`height: auto`), não por `max-height`
 * chutado — respostas de tamanhos diferentes fecham no mesmo ritmo.
 */

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

export interface FaqItem {
  q: string;
  a: string;
}

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<string | null>(items[0]?.q ?? null);
  const reduceMotion = useReducedMotion();

  return (
    <div className="divide-y divide-border/70 border-y border-border/70">
      {items.map((item) => {
        const expanded = open === item.q;
        const panelId = `faq-panel-${item.q.length}-${item.q.slice(0, 8)}`;
        return (
          <div key={item.q}>
            <h3>
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => setOpen(expanded ? null : item.q)}
                className={cn(
                  "flex w-full items-center justify-between gap-4 py-4 text-left",
                  "text-[15px] font-medium transition-colors",
                  expanded ? "text-navy-900" : "text-foreground hover:text-navy-700",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                {item.q}
                <span
                  aria-hidden
                  className={cn(
                    "relative h-6 w-6 flex-none rounded-full border transition-colors",
                    expanded
                      ? "border-gold-500 bg-gold-500 text-navy-950"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {/* Um "+" que vira "−" girando: dois traços, sem trocar de ícone. */}
                  <span className="absolute left-1/2 top-1/2 h-px w-2.5 -translate-x-1/2 -translate-y-1/2 bg-current" />
                  <motion.span
                    initial={false}
                    animate={reduceMotion ? {} : { rotate: expanded ? 0 : 90 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="absolute left-1/2 top-1/2 h-px w-2.5 -translate-x-1/2 -translate-y-1/2 bg-current"
                  />
                </span>
              </button>
            </h3>

            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  id={panelId}
                  initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="overflow-hidden"
                >
                  <p className="pb-5 pr-8 text-sm leading-relaxed text-muted-foreground">
                    {item.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
