"use client";

import { useEffect, useId, useRef, useState } from "react";
import { markNotificationReadAction } from "@/actions/shared/notifications";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { NotificationItem } from "@/repositories/notifications";
import { BellIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

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
   * dropdown para a direita — evita que ele estoure para fora da tela
   * quando o gatilho mora perto da borda esquerda. */
  variant?: "default" | "rail";
  /** Só usado com `variant="rail"`: rótulo ao lado do ícone. */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initialNotifications);
  const [unread, setUnread] = useState(initialUnreadCount);
  const ref = useRef<HTMLDivElement>(null);
  // A sidebar monta um NotificationBell para desktop e outro para mobile ao
  // mesmo tempo (visibilidade só por CSS, os dois ficam no DOM). O client do
  // navegador é singleton, então duas instâncias pedindo o mesmo tópico
  // colidiriam: a segunda chamaria `.on()` num canal que a primeira já
  // inscreveu, e o Realtime rejeita isso. `useId` garante um tópico próprio
  // por instância montada.
  const instanceId = useId();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

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
          setItems((prev) =>
            [{ ...row, readAt: row.read_at, createdAt: row.created_at }, ...prev].slice(
              0,
              20,
            ),
          );
          setUnread((n) => n + 1);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, instanceId]);

  async function handleOpenItem(id: string, wasUnread: boolean) {
    if (wasUnread) {
      setUnread((n) => Math.max(0, n - 1));
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, readAt: new Date().toISOString() } : i)),
      );
      await markNotificationReadAction(id);
    }
  }

  const dropdown = (positionClass: string, surfaceClass: string) =>
    open && (
      <div className={cn(positionClass, surfaceClass)}>
        <div className="max-h-80 overflow-y-auto p-2">
          {items.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">Nenhuma notificação.</p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleOpenItem(n.id, !n.readAt)}
                className={
                  n.readAt
                    ? "block w-full rounded-md p-2 text-left text-sm hover:bg-muted"
                    : "block w-full rounded-md bg-primary/5 p-2 text-left text-sm font-medium hover:bg-primary/10"
                }
              >
                <p>{n.title}</p>
                {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
              </button>
            ))
          )}
        </div>
      </div>
    );

  if (variant === "rail") {
    const railClass =
      theme === "admin"
        ? "text-admin-shell-foreground/70 hover:text-admin-shell-foreground focus-visible:ring-navy-900"
        : theme === "app"
          ? "text-app-shell-foreground/70 hover:bg-app-shell-foreground/10 hover:text-app-shell-foreground focus-visible:ring-app-shell-foreground"
          : "text-muted-foreground hover:bg-navy-50 hover:text-navy-800 focus-visible:ring-ring";
    return (
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Notificações"
          className={cn(
            "group relative flex h-10 w-full items-center gap-3 rounded-xl pl-2.5 pr-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
            railClass,
          )}
        >
          <span className="relative grid h-[18px] w-[18px] flex-none place-items-center">
            <BellIcon className="h-[18px] w-[18px]" />
            {unread > 0 && (
              <span className="absolute -right-2 -top-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-semibold text-destructive-foreground">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </span>
          {label && (
            <span data-nav-label className="truncate whitespace-nowrap opacity-0">
              {label}
            </span>
          )}
        </button>

        {dropdown(
          "absolute left-full top-0 z-50 ml-2 w-80 rounded-md border border-border bg-background shadow-lg",
          "",
        )}
      </div>
    );
  }

  const buttonClass =
    theme === "admin"
      ? "relative rounded-md border border-admin-border px-2.5 py-1.5 text-sm hover:bg-admin-muted"
      : theme === "app"
        ? "relative rounded-md border border-app-shell-border px-2.5 py-1.5 text-sm hover:bg-app-shell-muted"
        : "relative rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-muted";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={buttonClass}
        aria-label="Notificações"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {dropdown(
        "absolute right-0 z-50 mt-2 w-80 rounded-md border shadow-lg",
        theme === "admin"
          ? "border-admin-border bg-admin-background"
          : "border-border bg-background",
      )}
    </div>
  );
}
