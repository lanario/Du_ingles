"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  BellIcon,
  CheckIcon,
  CloseIcon,
  EyeIcon,
  SpinnerIcon,
} from "@/components/ui/icons";
import type { NotificationItem } from "@/repositories/notifications";
import {
  fullTimestamp,
  groupByBucket,
  relativeTime,
  visualFor,
  type NotificationTone,
} from "@/lib/notifications";

export type NotificationFilter = "all" | "unread";

export interface PanelAnchor {
  /** Posição já resolvida em coordenadas de viewport (`position: fixed`). */
  style: CSSProperties;
  /** Origem da escala na entrada — o painel "nasce" do gatilho. */
  origin: string;
}

/** Paleta por tom: mesmo desenho em todos os shells, só o acento muda. */
const TONE: Record<NotificationTone, { icon: string; chip: string; rail: string }> = {
  gold: {
    icon: "bg-gold-100 text-gold-700 ring-gold-500/25",
    chip: "bg-gold-100 text-gold-700",
    rail: "bg-gold-500",
  },
  navy: {
    icon: "bg-navy-50 text-navy-700 ring-navy-500/20",
    chip: "bg-navy-50 text-navy-700",
    rail: "bg-navy-600",
  },
  info: {
    icon: "bg-sky-50 text-sky-700 ring-sky-500/20",
    chip: "bg-sky-50 text-sky-700",
    rail: "bg-sky-500",
  },
  success: {
    icon: "bg-emerald-50 text-emerald-700 ring-emerald-500/20",
    chip: "bg-emerald-50 text-emerald-700",
    rail: "bg-emerald-500",
  },
  warning: {
    icon: "bg-amber-50 text-amber-700 ring-amber-500/25",
    chip: "bg-amber-50 text-amber-700",
    rail: "bg-amber-500",
  },
  danger: {
    icon: "bg-red-50 text-red-700 ring-red-500/20",
    chip: "bg-red-50 text-red-700",
    rail: "bg-red-500",
  },
  neutral: {
    icon: "bg-muted text-muted-foreground ring-border",
    chip: "bg-muted text-muted-foreground",
    rail: "bg-navy-300",
  },
};

interface PanelProps {
  /** O dono do painel reposiciona o nó a cada frame — por isso o ref vem de fora. */
  panelRef: React.RefObject<HTMLDivElement | null>;
  items: NotificationItem[];
  unread: number;
  filter: NotificationFilter;
  onFilterChange: (filter: NotificationFilter) => void;
  anchor: PanelAnchor;
  /** Abaixo de `sm` o painel vira gaveta inferior arrastável. */
  sheet: boolean;
  markingAll: boolean;
  onClose: () => void;
  onOpenItem: (item: NotificationItem) => void;
  onToggleRead: (item: NotificationItem) => void;
  onMarkAll: () => void;
}

export function NotificationPanel({
  panelRef,
  items,
  unread,
  filter,
  onFilterChange,
  anchor,
  sheet,
  markingAll,
  onClose,
  onOpenItem,
  onToggleRead,
  onMarkAll,
}: PanelProps) {
  const reduceMotion = useReducedMotion();
  const listRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);

  // Um único "agora" por abertura: todos os rótulos relativos saem do mesmo
  // instante, então itens da mesma leva nunca aparecem como "agora" e "1 min"
  // lado a lado.
  const now = useMemo(() => new Date(), []);

  const visible = useMemo(
    () => (filter === "unread" ? items.filter((item) => !item.readAt) : items),
    [items, filter],
  );
  const groups = useMemo(() => groupByBucket(visible, now), [visible, now]);

  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
  }, [panelRef]);

  // Fade no rodapé da lista só enquanto ainda houver conteúdo abaixo.
  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    function update() {
      if (!node) return;
      setAtBottom(node.scrollTop + node.clientHeight >= node.scrollHeight - 4);
    }
    update();
    node.addEventListener("scroll", update, { passive: true });
    return () => node.removeEventListener("scroll", update);
  }, [visible.length]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;

    const nodes = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>("[data-notif-item]") ?? [],
    );
    if (nodes.length === 0) return;
    event.preventDefault();

    const current = nodes.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? nodes.length - 1
          : event.key === "ArrowDown"
            ? (current + 1) % nodes.length
            : current <= 0
              ? nodes.length - 1
              : current - 1;
    nodes[next]?.focus();
  }

  const surface = cn(
    "pointer-events-auto z-[95] flex flex-col overflow-hidden border border-border bg-background text-foreground",
    "shadow-[0_1px_2px_rgba(11,26,51,0.06),0_24px_60px_-12px_rgba(11,26,51,0.28)]",
    "focus-visible:outline-none",
    sheet
      ? "fixed inset-x-0 bottom-0 max-h-[82svh] rounded-t-3xl border-b-0 pb-[env(safe-area-inset-bottom,0px)]"
      : "fixed w-[min(23rem,calc(100vw-1.5rem))] rounded-2xl",
  );

  const body = (
    <>
      {sheet && (
        <div className="flex justify-center pb-1 pt-2.5">
          <span aria-hidden className="h-1 w-10 rounded-full bg-border" />
        </div>
      )}

      <header className="flex items-start gap-2 px-4 pb-2.5 pt-3.5">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold tracking-tight">Notificações</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {unread > 0
              ? `${unread} não lida${unread > 1 ? "s" : ""}`
              : "Você está em dia"}
          </p>
        </div>

        <AnimatePresence initial={false}>
          {unread > 0 && (
            <motion.button
              type="button"
              onClick={onMarkAll}
              disabled={markingAll}
              initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 520, damping: 34 }}
              className="flex flex-none items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-navy-700 transition-colors hover:border-navy-300 hover:bg-navy-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-60"
            >
              {markingAll ? (
                <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckIcon className="h-3.5 w-3.5" />
              )}
              Marcar todas
            </motion.button>
          )}
        </AnimatePresence>

        {sheet && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar notificações"
            className="grid h-8 w-8 flex-none place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        )}
      </header>

      <div className="px-3 pb-2">
        <div className="flex gap-1 rounded-full bg-muted p-0.5">
          {(
            [
              ["all", "Todas", items.length],
              ["unread", "Não lidas", unread],
            ] as const
          ).map(([value, label, count]) => {
            const active = filter === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onFilterChange(value)}
                aria-pressed={active}
                className={cn(
                  "relative flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "text-navy-900"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="notif-filter-pill"
                    aria-hidden
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 520, damping: 40, mass: 0.7 }
                    }
                    className="absolute inset-0 -z-10 rounded-full bg-background shadow-[0_1px_2px_rgba(11,26,51,0.10)]"
                  />
                )}
                <span className="relative">
                  {label}
                  {count > 0 && (
                    <span
                      className={cn(
                        "ml-1.5 text-[10px] tabular-nums",
                        active ? "text-navy-600" : "text-muted-foreground/70",
                      )}
                    >
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={listRef}
          className="max-h-[min(26rem,60svh)] overflow-y-auto overscroll-contain px-2 pb-2"
        >
          {visible.length === 0 ? (
            <EmptyState filter={filter} />
          ) : (
            groups.map((group) => (
              <section key={group.bucket}>
                <h3 className="sticky top-0 z-10 bg-background/90 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground backdrop-blur">
                  {group.label}
                </h3>
                <AnimatePresence initial={false} mode="popLayout">
                  {group.items.map((item, index) => (
                    <Row
                      key={item.id}
                      item={item}
                      index={index}
                      now={now}
                      reduceMotion={Boolean(reduceMotion)}
                      onOpen={() => onOpenItem(item)}
                      onToggleRead={() => onToggleRead(item)}
                    />
                  ))}
                </AnimatePresence>
              </section>
            ))
          )}
        </div>

        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background to-transparent transition-opacity duration-200",
            atBottom ? "opacity-0" : "opacity-100",
          )}
        />
      </div>

      {!sheet && (
        <footer className="flex items-center justify-between border-t border-border/70 px-4 py-2 text-[10px] text-muted-foreground">
          <span>Atualiza em tempo real</span>
          <span>
            <kbd className="rounded border border-border px-1 py-px font-sans">Esc</kbd>{" "}
            fecha
          </span>
        </footer>
      )}
    </>
  );

  if (sheet) {
    return (
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Central de notificações"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
        animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
        transition={
          reduceMotion
            ? { duration: 0.12 }
            : { type: "spring", stiffness: 420, damping: 40, mass: 0.9 }
        }
        drag={reduceMotion ? false : "y"}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.35 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 96 || info.velocity.y > 640) onClose();
        }}
        className={surface}
      >
        {body}
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={panelRef}
      role="dialog"
      aria-label="Central de notificações"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      style={{ ...anchor.style, transformOrigin: anchor.origin }}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -4 }}
      transition={
        reduceMotion
          ? { duration: 0.12 }
          : { type: "spring", stiffness: 560, damping: 38, mass: 0.7 }
      }
      className={surface}
    >
      {body}
    </motion.div>
  );
}

/* -------------------------------------------------------------------- item */

function Row({
  item,
  index,
  now,
  reduceMotion,
  onOpen,
  onToggleRead,
}: {
  item: NotificationItem;
  index: number;
  now: Date;
  reduceMotion: boolean;
  onOpen: () => void;
  onToggleRead: () => void;
}) {
  const visual = visualFor(item.type);
  const tone = TONE[visual.tone];
  const Icon = visual.icon;
  const unread = !item.readAt;

  return (
    <motion.div
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 12, height: 0 }}
      transition={
        reduceMotion
          ? { duration: 0.12 }
          : {
              type: "spring",
              stiffness: 500,
              damping: 40,
              mass: 0.6,
              delay: Math.min(index * 0.028, 0.18),
            }
      }
      className="group/row relative"
    >
      <button
        type="button"
        data-notif-item
        onClick={onOpen}
        title={fullTimestamp(item.createdAt)}
        className={cn(
          "flex w-full gap-3 rounded-2xl p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          unread ? "bg-navy-50/60 hover:bg-navy-50" : "hover:bg-muted/70",
        )}
      >
        {unread && (
          <span
            aria-hidden
            className={cn(
              "absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-full",
              tone.rail,
            )}
          />
        )}

        <span
          aria-hidden
          className={cn(
            "mt-0.5 grid h-9 w-9 flex-none place-items-center rounded-xl ring-1 transition-transform duration-200 group-hover/row:scale-105",
            tone.icon,
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-[13px] leading-5",
                unread
                  ? "font-semibold text-foreground"
                  : "font-medium text-foreground/75",
              )}
            >
              {item.title}
            </span>
            <span className="flex-none text-[11px] tabular-nums text-muted-foreground">
              {relativeTime(item.createdAt, now.getTime())}
            </span>
          </span>

          {item.body && (
            <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-muted-foreground">
              {item.body}
            </span>
          )}

          <span className="mt-1.5 flex items-center gap-1.5">
            <span
              className={cn(
                "rounded-full px-1.5 py-px text-[10px] font-medium uppercase tracking-wide",
                tone.chip,
              )}
            >
              {visual.label}
            </span>
            {item.link && (
              <span className="text-[10px] font-medium text-navy-600 opacity-0 transition-opacity group-hover/row:opacity-100">
                Abrir →
              </span>
            )}
          </span>
        </span>
      </button>

      <button
        type="button"
        tabIndex={-1}
        onClick={onToggleRead}
        aria-label={unread ? "Marcar como lida" : "Marcar como não lida"}
        title={unread ? "Marcar como lida" : "Marcar como não lida"}
        className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-full border border-border bg-background text-muted-foreground opacity-0 shadow-sm transition-all hover:border-navy-300 hover:text-navy-700 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/row:opacity-100"
      >
        {unread ? (
          <CheckIcon className="h-3.5 w-3.5" />
        ) : (
          <EyeIcon className="h-3.5 w-3.5" />
        )}
      </button>
    </motion.div>
  );
}

function EmptyState({ filter }: { filter: NotificationFilter }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
        {filter === "unread" ? (
          <CheckIcon className="h-5 w-5" />
        ) : (
          <BellIcon className="h-5 w-5" />
        )}
      </span>
      <p className="text-sm font-medium text-foreground">
        {filter === "unread" ? "Nada por ler" : "Nenhuma notificação"}
      </p>
      <p className="max-w-[15rem] text-xs leading-5 text-muted-foreground">
        {filter === "unread"
          ? "Você já viu tudo o que chegou até agora."
          : "Avisos, tarefas e mudanças de turma aparecem aqui assim que acontecem."}
      </p>
    </div>
  );
}
