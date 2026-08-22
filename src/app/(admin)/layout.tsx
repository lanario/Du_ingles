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
      className="fixed inset-0 flex flex-col overflow-hidden bg-admin-background text-admin-foreground md:flex-row"
    >
      {/* No mobile a `AdminSidebar` renderiza um cabeçalho no fluxo (a gaveta
          é `fixed`), então esta coluna precisa ser `flex-col` até `md` —
          senão a barra vira uma coluna de 100vh ao lado do conteúdo. */}
      <AdminSidebar
        organizationLabel="Painel administrativo"
        userId={ctx.userId}
        email={ctx.email}
        initialNotifications={notifications}
        initialUnreadCount={unreadCount}
      />

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {/* A chave "ver como" só flutua a partir de `md`; abaixo disso ela
            vive no cabeçalho mobile, em versão `collapsed`. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 hidden items-center gap-4 px-6 pt-4 text-admin-foreground md:flex">
          <div className="pointer-events-auto ml-auto rounded-full border border-admin-accent p-0.5">
            <RoleSwitch active="admin" awayLabel="Aluno" awayRole="student" />
          </div>
        </div>

        <main
          data-scroll-root
          className="bg-admin-canvas min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-5 md:px-6 md:pb-6 md:pt-20"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
