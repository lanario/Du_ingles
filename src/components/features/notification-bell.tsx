"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import gsap from "gsap";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  markNotificationUnreadAction,
} from "@/actions/shared/notifications";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { NotificationItem } from "@/repositories/notifications";
import { BellIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { relativeTime, visualFor } from "@/lib/notifications";
import {
  NotificationPanel,
  type NotificationFilter,
  type PanelAnchor,
} from "@/components/features/notification-panel";

const PANEL_WIDTH = 368;
const FLASH_WIDTH = 300;
const GAP = 10;
const MARGIN = 12;
const FLASH_MS = 6000;
const MAX_ITEMS = 30;

/** Instâncias irmãs (desktop + mobile montam as duas ao mesmo tempo) se
 * espelham por este evento — sem ele, marcar como lida numa não mexeria na
 * outra até o próximo carregamento. */
const SYNC_EVENT = "du:notifications-sync";

interface SyncDetail {
  origin: string;
  ids: string[] | "all";
  readAt: string | null;
}

function broadcast(detail: SyncDetail) {
  window.dispatchEvent(new CustomEvent<SyncDetail>(SYNC_EVENT, { detail }));
}

type Variant = "default" | "rail";

/**
 * Ancoragem em coordenadas de viewport. É recalculada a cada frame enquanto o
 * painel está aberto: a sidebar anima a própria largura por mola, então uma
 * posição medida só na abertura descolaria do gatilho no meio da animação.
 */
function anchorFor(
  trigger: HTMLElement,
  variant: Variant,
  width: number,
): PanelAnchor & { style: CSSProperties } {
  const rect = trigger.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(width, vw - MARGIN * 2);

  if (variant === "rail") {
    // O gatilho vive num container de largura fixa que fica escondido sob a
    // máscara da sidebar — a borda visível é a do painel animado.
    const shell = trigger.closest<HTMLElement>("[data-sidebar-panel]");
    const shellRight = shell ? shell.getBoundingClientRect().right : rect.right;
    const fitsRight = shellRight + GAP + w <= vw - MARGIN;
    const left = fitsRight
      ? shellRight + GAP
      : Math.max(MARGIN, Math.min(rect.left, vw - w - MARGIN));
    const bottom = Math.max(MARGIN, Math.min(vh - rect.bottom - 4, vh - 160));
    return {
      style: { left, bottom, width: w, maxHeight: vh - bottom - MARGIN },
      origin: fitsRight ? "bottom left" : "bottom center",
    };
  }

  const spaceBelow = vh - rect.bottom;
  const flip = spaceBelow < 260 && rect.top > spaceBelow;
  const right = Math.max(MARGIN, vw - rect.right);

  return flip
    ? {
        style: {
          right,
          bottom: vh - rect.top + GAP,
          width: w,
          maxHeight: rect.top - GAP - MARGIN,
        },
        origin: "bottom right",
      }
    : {
        style: {
          right,
          top: rect.bottom + GAP,
          width: w,
          maxHeight: vh - rect.bottom - GAP - MARGIN,
        },
        origin: "top right",
      };
}

/** Escreve a posição direto no nó — evita re-render a 60 fps durante a mola. */
function applyAnchor(node: HTMLElement, trigger: HTMLElement, variant: Variant) {
  const { style } = anchorFor(trigger, variant, PANEL_WIDTH);
  node.style.left = style.left === undefined ? "auto" : `${style.left as number}px`;
  node.style.right = style.right === undefined ? "auto" : `${style.right as number}px`;
  node.style.top = style.top === undefined ? "auto" : `${style.top as number}px`;
  node.style.bottom = style.bottom === undefined ? "auto" : `${style.bottom as number}px`;
  node.style.maxHeight = `${style.maxHeight as number}px`;
}

export function NotificationBell({
  userId,
  initialNotifications,
  initialUnreadCount,
  theme = "light",
  variant = "default",
  label,
}: {
  userId: string;
  initialNotifications: NotificationItem[];
  initialUnreadCount: number;
  theme?: "light" | "admin" | "app";
  /** "rail" veste o gatilho como uma linha de navegação (ícone + rótulo
   * opcional que aparece/some com o hover-expand da sidebar) e abre o
   * painel para a direita — evita que ele estoure para fora da tela
   * quando o gatilho mora perto da borda esquerda. */
  variant?: "default" | "rail";
  /** Só usado com `variant="rail"`: rótulo ao lado do ícone. */
  label?: string;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [items, setItems] = useState(initialNotifications);
  const [unread, setUnread] = useState(initialUnreadCount);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [flash, setFlash] = useState<NotificationItem | null>(null);
  const [anchor, setAnchor] = useState<PanelAnchor>({ style: {}, origin: "top right" });
  const [markingAll, startMarkAll] = useTransition();

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<SVGSVGElement>(null);
  const pulseRef = useRef<HTMLSpanElement>(null);
  const flashTimer = useRef<number | null>(null);
  // Espelho da lista para os handlers do Realtime: eles vivem fora do ciclo de
  // render e não podem ler `items` do closure sem reassinar o canal.
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // A sidebar monta um NotificationBell para desktop e outro para mobile ao
  // mesmo tempo (visibilidade só por CSS, os dois ficam no DOM). O client do
  // navegador é singleton, então duas instâncias pedindo o mesmo tópico
  // colidiriam: a segunda chamaria `.on()` num canal que a primeira já
  // inscreveu, e o Realtime rejeita isso. `useId` garante um tópico próprio
  // por instância montada.
  const instanceId = useId();

  useEffect(() => setMounted(true), []);

  /* ------------------------------------------------------------- animação */

  /** Balança o sino e dispara a onda — chamado quando algo novo chega. */
  const ring = useCallback(() => {
    if (reduceMotion) return;
    const bell = bellRef.current;
    if (bell) {
      gsap
        .timeline({ defaults: { ease: "power2.out", transformOrigin: "50% 15%" } })
        .set(bell, { rotate: 0 })
        .to(bell, { rotate: -16, duration: 0.09 })
        .to(bell, { rotate: 12, duration: 0.11 })
        .to(bell, { rotate: -8, duration: 0.1 })
        .to(bell, { rotate: 5, duration: 0.09 })
        .to(bell, { rotate: 0, duration: 0.12, ease: "power2.inOut" });
    }
    if (pulseRef.current) {
      gsap.fromTo(
        pulseRef.current,
        { scale: 0.55, opacity: 0.6 },
        { scale: 2.4, opacity: 0, duration: 0.85, ease: "power2.out" },
      );
    }
  }, [reduceMotion]);

  // Respiração lenta do halo enquanto houver não lidas: chama atenção sem
  // virar um piscar constante na periferia da visão.
  useEffect(() => {
    const pulse = pulseRef.current;
    if (!pulse || reduceMotion || unread === 0) return;
    const tween = gsap.fromTo(
      pulse,
      { scale: 0.7, opacity: 0.35 },
      {
        scale: 1.9,
        opacity: 0,
        duration: 1.6,
        ease: "power2.out",
        repeat: -1,
        repeatDelay: 5,
      },
    );
    return () => {
      tween.kill();
      gsap.set(pulse, { scale: 0.7, opacity: 0 });
    };
  }, [unread, reduceMotion]);

  /* --------------------------------------------------------------- estado */

  const applyRead = useCallback((ids: string[] | "all", readAt: string | null) => {
    setItems((prev) =>
      prev.map((item) =>
        ids === "all" || ids.includes(item.id) ? { ...item, readAt } : item,
      ),
    );
    setUnread((current) => {
      if (ids === "all") return readAt ? 0 : current;
      const delta = ids.length * (readAt ? -1 : 1);
      return Math.max(0, current + delta);
    });
  }, []);

  // Espelho entre instâncias irmãs da mesma aba.
  useEffect(() => {
    function onSync(event: Event) {
      const detail = (event as CustomEvent<SyncDetail>).detail;
      if (!detail || detail.origin === instanceId) return;
      applyRead(detail.ids, detail.readAt);
    }
    window.addEventListener(SYNC_EVENT, onSync);
    return () => window.removeEventListener(SYNC_EVENT, onSync);
  }, [instanceId, applyRead]);

  // Realtime: INSERT traz a novidade, UPDATE mantém o estado de leitura
  // coerente quando a mesma conta está aberta em outro dispositivo.
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`notifications:${userId}:${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as NotificationItem & {
            read_at: string | null;
            created_at: string;
          };
          const item: NotificationItem = {
            ...row,
            readAt: row.read_at,
            createdAt: row.created_at,
          };
          setItems((prev) =>
            prev.some((existing) => existing.id === item.id)
              ? prev
              : [item, ...prev].slice(0, MAX_ITEMS),
          );
          if (!item.readAt) setUnread((n) => n + 1);
          setFlash(item);
          ring();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as { id: string; read_at: string | null };
          const before = itemsRef.current.find((item) => item.id === row.id);
          if (!before || before.readAt === row.read_at) return;
          setItems((prev) =>
            prev.map((item) =>
              item.id === row.id ? { ...item, readAt: row.read_at } : item,
            ),
          );
          setUnread((n) => Math.max(0, n + (row.read_at ? -1 : 1)));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, instanceId, ring]);

  // O flash some sozinho; abrir o painel o dispensa na hora.
  useEffect(() => {
    if (!flash) return;
    if (open) {
      setFlash(null);
      return;
    }
    flashTimer.current = window.setTimeout(() => setFlash(null), FLASH_MS);
    return () => {
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    };
  }, [flash, open]);

  /* ------------------------------------------------------------ posições */

  useEffect(() => {
    if (!mounted) return;
    const query = window.matchMedia("(max-width: 639px)");
    const update = () => setSheet(query.matches);
    update();
    // `resize` além do `change` da media query: alguns ambientes (emulação de
    // dispositivo no DevTools, por exemplo) redimensionam sem disparar o
    // `change`, e o painel ficaria preso no formato errado.
    query.addEventListener("change", update);
    window.addEventListener("resize", update);
    return () => {
      query.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, [mounted]);

  // Trava o scroll do fundo enquanto a gaveta mobile está aberta.
  useEffect(() => {
    if (!open || !sheet) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, sheet]);

  useEffect(() => {
    if (!open || sheet) return;
    let frame = 0;
    const tick = () => {
      const node = panelRef.current;
      const trigger = triggerRef.current;
      if (node && trigger) applyAnchor(node, trigger, variant);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [open, sheet, variant]);

  // Fechar ao clicar fora. O painel mora num portal, então precisa entrar no
  // teste explicitamente — `contains` no gatilho não alcança.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Esc fecha mesmo quando o foco escapou do painel (clique no shell, por ex.).
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  /* --------------------------------------------------------------- ações */

  function openPanel() {
    const trigger = triggerRef.current;
    if (trigger) setAnchor(anchorFor(trigger, variant, PANEL_WIDTH));
    setFlash(null);
    setOpen(true);
  }

  function closePanel() {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }

  async function markRead(item: NotificationItem) {
    if (item.readAt) return;
    const now = new Date().toISOString();
    applyRead([item.id], now);
    broadcast({ origin: instanceId, ids: [item.id], readAt: now });
    const result = await markNotificationReadAction(item.id);
    if (!result.success) {
      applyRead([item.id], null);
      broadcast({ origin: instanceId, ids: [item.id], readAt: null });
    }
  }

  async function toggleRead(item: NotificationItem) {
    if (!item.readAt) {
      await markRead(item);
      return;
    }
    applyRead([item.id], null);
    broadcast({ origin: instanceId, ids: [item.id], readAt: null });
    const result = await markNotificationUnreadAction(item.id);
    if (!result.success) {
      applyRead([item.id], item.readAt);
      broadcast({ origin: instanceId, ids: [item.id], readAt: item.readAt });
    }
  }

  function openItem(item: NotificationItem) {
    void markRead(item);
    if (!item.link) return;
    setOpen(false);
    router.push(item.link as Route);
  }

  function markAll() {
    const snapshot = items;
    const previousUnread = unread;
    const now = new Date().toISOString();
    applyRead("all", now);
    broadcast({ origin: instanceId, ids: "all", readAt: now });

    startMarkAll(async () => {
      const result = await markAllNotificationsReadAction();
      if (!result.success) {
        setItems(snapshot);
        setUnread(previousUnread);
      }
    });
  }

  /* ------------------------------------------------------------- trigger */

  const badge = (small: boolean) => (
    <AnimatePresence initial={false}>
      {unread > 0 && (
        <motion.span
          key="badge"
          initial={reduceMotion ? { opacity: 0 } : { scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { scale: 0.3, opacity: 0 }}
          transition={{ type: "spring", stiffness: 640, damping: 22, mass: 0.5 }}
          className={cn(
            "pointer-events-none absolute flex items-center justify-center rounded-full bg-destructive font-semibold tabular-nums text-destructive-foreground ring-2",
            theme === "app"
              ? "ring-app-shell"
              : theme === "admin"
                ? "ring-admin-shell"
                : "ring-background",
            small
              ? "-right-2 -top-2 h-4 min-w-4 px-1 text-[9px]"
              : "-right-1.5 -top-1.5 h-[18px] min-w-[18px] px-1 text-[10px]",
          )}
        >
          <motion.span
            key={unread}
            initial={reduceMotion ? false : { y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 700, damping: 26 }}
          >
            {unread > 99 ? "99+" : unread}
          </motion.span>
        </motion.span>
      )}
    </AnimatePresence>
  );

  const pulse = (
    <span
      ref={pulseRef}
      aria-hidden
      style={{ opacity: 0 }}
      className="pointer-events-none absolute inset-0 rounded-full bg-destructive/35"
    />
  );

  const ariaLabel =
    unread > 0
      ? `Notificações, ${unread} não lida${unread > 1 ? "s" : ""}`
      : "Notificações";

  let trigger: React.ReactNode;

  if (variant === "rail") {
    const railClass =
      theme === "admin"
        ? "text-admin-shell-foreground/70 hover:bg-navy-900/10 hover:text-admin-shell-foreground focus-visible:ring-navy-900"
        : theme === "app"
          ? "text-app-shell-foreground/70 hover:bg-app-shell-foreground/10 hover:text-app-shell-foreground focus-visible:ring-gold-400"
          : "text-muted-foreground hover:bg-navy-50 hover:text-navy-800 focus-visible:ring-ring";

    const activeClass =
      theme === "admin"
        ? "bg-navy-900/15 text-admin-shell-foreground"
        : theme === "app"
          ? "bg-app-shell-foreground/10 text-app-shell-foreground"
          : "bg-navy-50 text-navy-800";

    trigger = (
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? closePanel() : openPanel())}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "group relative flex h-10 w-full items-center gap-3 rounded-xl pl-2.5 pr-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          theme === "app"
            ? "focus-visible:ring-offset-app-shell"
            : theme === "admin"
              ? "focus-visible:ring-offset-admin-shell"
              : "focus-visible:ring-offset-background",
          railClass,
          open && activeClass,
        )}
      >
        <span className="relative grid h-[18px] w-[18px] flex-none place-items-center">
          {pulse}
          <BellIcon
            ref={bellRef}
            className="relative h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-110"
          />
          {badge(true)}
        </span>
        {label && (
          <span data-nav-label className="truncate whitespace-nowrap opacity-0">
            {label}
          </span>
        )}
      </button>
    );
  } else {
    const buttonClass =
      theme === "admin"
        ? "border-admin-shell-border/60 bg-navy-900/5 text-admin-shell-foreground hover:bg-navy-900/10 focus-visible:ring-navy-900 focus-visible:ring-offset-admin-shell"
        : theme === "app"
          ? "border-app-shell-border bg-app-shell-foreground/5 text-app-shell-foreground hover:bg-app-shell-foreground/10 focus-visible:ring-gold-400 focus-visible:ring-offset-app-shell"
          : "border-border bg-background text-foreground hover:bg-muted focus-visible:ring-ring focus-visible:ring-offset-background";

    const openClass =
      theme === "admin"
        ? "border-navy-900/30 bg-navy-900/12"
        : theme === "app"
          ? "border-app-shell-foreground/25 bg-app-shell-foreground/12"
          : "border-navy-300 bg-muted";

    trigger = (
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? closePanel() : openPanel())}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "group relative grid h-10 w-10 place-items-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          buttonClass,
          open && openClass,
        )}
      >
        {pulse}
        <BellIcon
          ref={bellRef}
          className="relative h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-110"
        />
        {badge(false)}
      </button>
    );
  }

  /* --------------------------------------------------------------- render */

  const overlay = mounted
    ? createPortal(
        <>
          <AnimatePresence>
            {open && sheet && (
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={closePanel}
                className="fixed inset-0 z-[90] bg-navy-950/45 backdrop-blur-[2px]"
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {open && (
              <NotificationPanel
                key="panel"
                panelRef={panelRef}
                items={items}
                unread={unread}
                filter={filter}
                onFilterChange={setFilter}
                anchor={anchor}
                sheet={sheet}
                markingAll={markingAll}
                onClose={closePanel}
                onOpenItem={openItem}
                onToggleRead={(item) => void toggleRead(item)}
                onMarkAll={markAll}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {flash && !open && !sheet && (
              <FlashCard
                key={flash.id}
                item={flash}
                variant={variant}
                triggerRef={triggerRef}
                reduceMotion={Boolean(reduceMotion)}
                onOpen={() => {
                  setFlash(null);
                  openPanel();
                }}
                onDismiss={() => setFlash(null)}
              />
            )}
          </AnimatePresence>
        </>,
        document.body,
      )
    : null;

  return (
    <div className="relative">
      {trigger}
      {overlay}
    </div>
  );
}

/* ---------------------------------------------------------------- flash */

/**
 * Prévia efêmera do que acabou de chegar, ancorada ao gatilho. Some sozinha e
 * nunca rouba o foco — é um aviso periférico, não um diálogo.
 */
function FlashCard({
  item,
  variant,
  triggerRef,
  reduceMotion,
  onOpen,
  onDismiss,
}: {
  item: NotificationItem;
  variant: Variant;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  reduceMotion: boolean;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const [style, setStyle] = useState<CSSProperties | null>(null);
  const visual = visualFor(item.type);
  const Icon = visual.icon;

  useEffect(() => {
    function place() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      // A sidebar mantém as versões desktop e mobile montadas ao mesmo tempo,
      // escondendo uma por CSS — mas o portal renderiza no `body` e escaparia
      // desse `hidden`. Sem o gatilho visível não há onde ancorar: a instância
      // escondida simplesmente não mostra o flash.
      const rect = trigger.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setStyle(null);
        return;
      }
      setStyle(anchorFor(trigger, variant, FLASH_WIDTH).style);
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [triggerRef, variant]);

  if (!style) return null;

  return (
    <motion.div
      role="status"
      aria-live="polite"
      style={{ ...style, maxHeight: undefined }}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -12, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8, scale: 0.97 }}
      transition={
        reduceMotion
          ? { duration: 0.15 }
          : { type: "spring", stiffness: 520, damping: 34, mass: 0.7 }
      }
      className="fixed z-[94] overflow-hidden rounded-2xl border border-border bg-background shadow-[0_1px_2px_rgba(11,26,51,0.06),0_18px_44px_-12px_rgba(11,26,51,0.3)]"
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-start gap-2.5 p-3 text-left transition-colors hover:bg-muted/60"
      >
        <span className="mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-lg bg-navy-50 text-navy-700 ring-1 ring-navy-500/20">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-5">
              {item.title}
            </span>
            <span className="flex-none text-[10px] text-muted-foreground">
              {relativeTime(item.createdAt)}
            </span>
          </span>
          {item.body && (
            <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-muted-foreground">
              {item.body}
            </span>
          )}
        </span>
      </button>

      <motion.span
        aria-hidden
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: FLASH_MS / 1000, ease: "linear" }}
        onAnimationComplete={onDismiss}
        className="block h-0.5 origin-left bg-navy-600/40"
      />
    </motion.div>
  );
}
