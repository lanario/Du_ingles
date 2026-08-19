"use client";

/**
 * Sessões geradas para a turma, em linha do tempo. A próxima aula fica em
 * destaque no topo — é a informação que o admin abre a página para conferir;
 * o histórico passado colapsa atrás de um botão para não empurrar o resto
 * para fora da tela.
 */

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CalendarIcon, ChevronIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { SessionListItem } from "@/repositories/class-sessions";
import type { SessionStatus } from "@/types/domain";

const STATUS_LABEL: Record<SessionStatus, string> = {
  scheduled: "Agendada",
  in_progress: "Em andamento",
  completed: "Concluída",
  cancelled: "Cancelada",
};

const STATUS_TONE: Record<SessionStatus, string> = {
  scheduled: "var(--navy-500)",
  in_progress: "var(--success)",
  completed: "var(--gold-700)",
  cancelled: "var(--muted-foreground)",
};

/** Quantas sessões futuras aparecem antes do "ver mais". */
const UPCOMING_VISIBLE = 6;

export function GroupSessions({ sessions }: { sessions: SessionListItem[] }) {
  const reduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [showPast, setShowPast] = useState(false);

  const { past, upcoming } = useMemo(() => {
    const now = Date.now();
    const sorted = [...sessions].sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );
    return {
      past: sorted.filter((item) => new Date(item.scheduledAt).getTime() < now).reverse(),
      upcoming: sorted.filter((item) => new Date(item.scheduledAt).getTime() >= now),
    };
  }, [sessions]);

  if (sessions.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-admin-border px-4 py-10 text-center text-sm text-admin-foreground/50">
        Nenhuma sessão gerada ainda — confira se a turma tem horários definidos na grade semanal.
      </p>
    );
  }

  const shown = expanded ? upcoming : upcoming.slice(0, UPCOMING_VISIBLE);
  const hidden = upcoming.length - shown.length;

  return (
    <div className="space-y-3">
      {upcoming.length === 0 ? (
        <p className="rounded-xl border border-dashed border-admin-border px-4 py-6 text-center text-sm text-admin-foreground/50">
          Nenhuma sessão futura — o período da turma pode ter terminado.
        </p>
      ) : (
        <ol className="relative space-y-2 border-l border-admin-border pl-4">
          <AnimatePresence initial={false}>
            {shown.map((session, index) => (
              <SessionRow
                key={session.id}
                session={session}
                index={index}
                next={index === 0}
                reduceMotion={Boolean(reduceMotion)}
              />
            ))}
          </AnimatePresence>
        </ol>
      )}

      {(hidden > 0 || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gold-700 transition-colors hover:text-gold-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
        >
          <ChevronIcon className={cn("h-3.5 w-3.5 transition-transform", expanded && "-rotate-90")} />
          {expanded ? "Mostrar menos" : `Ver mais ${hidden} ${hidden === 1 ? "sessão" : "sessões"}`}
        </button>
      )}

      {past.length > 0 && (
        <div className="border-t border-admin-border pt-3">
          <button
            type="button"
            onClick={() => setShowPast((value) => !value)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-admin-foreground/55 transition-colors hover:text-admin-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
          >
            <ChevronIcon
              className={cn("h-3.5 w-3.5 transition-transform", showPast && "-rotate-90")}
            />
            Histórico ({past.length} {past.length === 1 ? "sessão" : "sessões"})
          </button>

          <AnimatePresence initial={false}>
            {showPast && (
              <motion.ol
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="mt-3 space-y-2 overflow-hidden border-l border-admin-border pl-4"
              >
                {past.map((session, index) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    index={index}
                    reduceMotion={Boolean(reduceMotion)}
                    dimmed
                  />
                ))}
              </motion.ol>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function SessionRow({
  session,
  index,
  next = false,
  dimmed = false,
  reduceMotion,
}: {
  session: SessionListItem;
  index: number;
  next?: boolean;
  dimmed?: boolean;
  reduceMotion: boolean;
}) {
  const status = session.status as SessionStatus;
  const tone = STATUS_TONE[status] ?? "var(--muted-foreground)";
  const date = new Date(session.scheduledAt);

  return (
    <motion.li
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index, 8) * 0.035, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "relative rounded-xl border px-3.5 py-2.5",
        next
          ? "border-gold-300 bg-gold-50/60"
          : "border-admin-border bg-admin-surface",
        dimmed && "opacity-70",
      )}
    >
      <span
        aria-hidden
        className="absolute -left-[21px] top-4 h-2.5 w-2.5 rounded-full ring-4 ring-[var(--admin-background)]"
        style={{ backgroundColor: tone }}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm text-admin-foreground">
            <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-admin-foreground/40" />
            <span className="tabular">
              {date.toLocaleString("pt-BR", {
                weekday: "short",
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {next && (
              <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-700">
                Próxima
              </span>
            )}
          </p>
          <p className="mt-0.5 truncate text-xs text-admin-foreground/50">
            {session.title} · {session.durationMinutes} min
          </p>
        </div>

        <span
          style={{
            color: tone,
            backgroundColor: `color-mix(in srgb, ${tone} 10%, #ffffff)`,
          }}
          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium"
        >
          {STATUS_LABEL[status] ?? status}
        </span>
      </div>
    </motion.li>
  );
}
