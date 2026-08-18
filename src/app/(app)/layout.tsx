import { requireRole } from "@/lib/auth/session";
import { logoutAction } from "@/actions/auth/logout";
import { Button } from "@/components/ui/button";
import { ViewAsBanner } from "@/components/features/admin/view-as-banner";
import { AppSidebar } from "@/components/features/app-sidebar";
import { NotificationBell } from "@/components/features/notification-bell";
import {
  listNotifications,
  countUnreadNotifications,
} from "@/repositories/notifications";

const ROLE_LABEL = { teacher: "Professor", student: "Aluno", admin: "Admin" } as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireRole(["teacher", "student"]);
  const [notifications, unreadCount] = await Promise.all([
    listNotifications(),
    countUnreadNotifications(),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      {ctx.isViewAs && <ViewAsBanner />}
      <header className="flex h-14 flex-none items-center justify-between border-b border-border px-6">
        <span className="font-semibold">Du Inglês</span>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <NotificationBell
            userId={ctx.userId}
            initialNotifications={notifications}
            initialUnreadCount={unreadCount}
          />
          <span>
            {ctx.email} · {ROLE_LABEL[ctx.effectiveRole]}
          </span>
          <form action={logoutAction}>
            <Button type="submit" variant="ghost">
              Sair
            </Button>
          </form>
        </div>
      </header>
      <div className="flex flex-1">
        <AppSidebar role={ctx.effectiveRole} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
