"use client";

import { useEffect, useRef, useState } from "react";
import { markNotificationReadAction } from "@/actions/shared/notifications";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { NotificationItem } from "@/repositories/notifications";

export function NotificationBell({
  userId,
  initialNotifications,
  initialUnreadCount,
  theme = "light",
}: {
  userId: string;
  initialNotifications: NotificationItem[];
  initialUnreadCount: number;
  theme?: "light" | "admin";
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initialNotifications);
  const [unread, setUnread] = useState(initialUnreadCount);
  const ref = useRef<HTMLDivElement>(null);

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
      .channel(`notifications:${userId}`)
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
  }, [userId]);

  async function handleOpenItem(id: string, wasUnread: boolean) {
    if (wasUnread) {
      setUnread((n) => Math.max(0, n - 1));
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, readAt: new Date().toISOString() } : i)),
      );
      await markNotificationReadAction(id);
    }
  }

  const buttonClass =
    theme === "admin"
      ? "relative rounded-md border border-admin-border px-2.5 py-1.5 text-sm hover:bg-admin-muted"
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

      {open && (
        <div
          className={
            theme === "admin"
              ? "absolute right-0 z-50 mt-2 w-80 rounded-md border border-admin-border bg-admin-background shadow-lg"
              : "absolute right-0 z-50 mt-2 w-80 rounded-md border border-border bg-background shadow-lg"
          }
        >
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
      )}
    </div>
  );
}
