import { requireRole } from "@/lib/auth/session";
import { logoutAction } from "@/actions/auth/logout";
import { AdminSidebar } from "@/components/features/admin/sidebar";
import { NotificationBell } from "@/components/features/notification-bell";
import {
  listNotifications,
  countUnreadNotifications,
} from "@/repositories/notifications";

/**
 * Tema visualmente distinto (grafite + acento âmbar, §8.1) — requisito
 * explícito do cliente para que o admin nunca confunda em qual contexto
 * está. `data-admin-theme` isola os tokens só dentro desta subárvore.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireRole(["admin"]);
  const [notifications, unreadCount] = await Promise.all([
    listNotifications(),
    countUnreadNotifications(),
  ]);

  return (
    <div
      data-admin-theme
      className="flex min-h-screen flex-col bg-admin-background text-admin-foreground"
    >
      <header className="flex h-14 flex-none items-center justify-between border-b border-admin-border px-6">
        <span className="font-semibold text-admin-accent">Du Inglês · Admin</span>
        <div className="flex items-center gap-4 text-sm">
          <NotificationBell
            userId={ctx.userId}
            initialNotifications={notifications}
            initialUnreadCount={unreadCount}
            theme="admin"
          />
          <span>{ctx.email}</span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-md border border-admin-border px-3 py-1.5 text-sm hover:bg-admin-muted"
            >
              Sair
            </button>
          </form>
        </div>
      </header>
      <div className="flex flex-1">
        <AdminSidebar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
