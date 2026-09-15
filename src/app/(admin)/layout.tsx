import { requireRole } from "@/lib/auth/session";
import { AdminSidebar } from "@/components/features/admin/sidebar";
import { LiveRefresh } from "@/components/features/live-refresh";
import { MotionProvider } from "@/components/motion/motion-provider";
import { LinkPrefetcher } from "@/components/features/link-prefetcher";
import { ShaderBackground } from "@/components/ui/shader-background";
import {
  listNotifications,
  countUnreadNotifications,
} from "@/repositories/notifications";
import { getMyProfile } from "@/repositories/users";

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
  const [notifications, unreadCount, profile] = await Promise.all([
    listNotifications(ctx.userId),
    countUnreadNotifications(ctx.userId),
    getMyProfile(ctx.userId),
  ]);

  return (
    <MotionProvider>
      <div
        data-admin-theme
        className="fixed inset-0 flex flex-col overflow-hidden text-admin-foreground md:flex-row"
      >
        {/* No mobile a `AdminSidebar` renderiza um cabeçalho no fluxo (a gaveta
          é `fixed`), então esta coluna precisa ser `flex-col` até `md` —
          senão a barra vira uma coluna de 100vh ao lado do conteúdo. */}
        <ShaderBackground />
        <LiveRefresh userId={ctx.userId} />
        <LinkPrefetcher />

        <AdminSidebar
          organizationLabel="Painel administrativo"
          userId={ctx.userId}
          email={ctx.email}
          fullName={ctx.fullName}
          avatarUrl={ctx.avatarUrl}
          profile={profile}
          initialNotifications={notifications}
          initialUnreadCount={unreadCount}
        />

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <main
            data-scroll-root
            className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-5 md:px-6 md:py-6"
          >
            {children}
          </main>
        </div>
      </div>
    </MotionProvider>
  );
}
