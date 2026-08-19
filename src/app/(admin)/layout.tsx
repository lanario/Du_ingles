import { requireRole } from "@/lib/auth/session";
import { AdminSidebar } from "@/components/features/admin/sidebar";
import { RoleSwitch } from "@/components/features/admin/role-switch";
import {
  listNotifications,
  countUnreadNotifications,
} from "@/repositories/notifications";

/**
 * Tema visualmente distinto (§8.1) — requisito explícito do cliente para que
 * o admin nunca confunda em qual contexto está. A separação agora vem da
 * inversão do chrome: barra lateral e topo em azul marinho sólido com acento
 * dourado, contra o canvas claro do conteúdo (a área do aluno/professor usa
 * exatamente o oposto). `data-admin-theme` mantém os tokens isolados nesta
 * subárvore.
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
      className="fixed inset-0 flex overflow-hidden bg-admin-background text-admin-foreground"
    >
      <AdminSidebar
        organizationLabel="Painel administrativo"
        userId={ctx.userId}
        email={ctx.email}
        initialNotifications={notifications}
        initialUnreadCount={unreadCount}
      />

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center gap-4 px-6 pt-4 text-admin-foreground">
          <span className="pointer-events-auto hidden text-sm font-semibold tracking-tight sm:inline md:hidden">
            Du Inglês <span className="text-accent">· Admin</span>
          </span>
          <div className="pointer-events-auto ml-auto rounded-full border border-admin-accent p-0.5">
            <RoleSwitch active="admin" awayLabel="Aluno" awayRole="student" />
          </div>
        </div>

        <main className="bg-admin-canvas min-h-0 min-w-0 flex-1 overflow-y-auto px-6 pb-6 pt-20">{children}</main>
      </div>
    </div>
  );
}
