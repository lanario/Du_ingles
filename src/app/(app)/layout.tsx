import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { AppSidebar } from "@/components/features/app-sidebar";
import { cn } from "@/lib/utils";
import {
  listNotifications,
  countUnreadNotifications,
} from "@/repositories/notifications";
import { getMyProfile } from "@/repositories/users";

/**
 * Sidebar hover-expand ocupando a tela inteira, sem cabeçalho acima — mesmo
 * modelo de navegação do shell do admin (rail que expande no hover/foco),
 * mas em chrome dourado sólido em vez de azul marinho sólido: a diferença
 * entre as duas áreas se lê antes mesmo de o conteúdo carregar.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireRole(["teacher", "student"]);
  // Esta área é do aluno. O professor tem a própria (`/professor`), com as
  // telas do painel recortadas para ele — e não transita entre as duas.
  if (ctx.effectiveRole === "teacher") redirect("/professor");

  const [notifications, unreadCount, profile] = await Promise.all([
    listNotifications(),
    countUnreadNotifications(),
    getMyProfile(ctx.userId),
  ]);

  const showAdminSwitch = ctx.realRole === "admin";

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background text-foreground">
      {/* `min-h-0` deixa a linha encolher abaixo da altura do conteúdo —
          senão o `overflow-y-auto` do <main> nunca entra em ação e a página
          inteira rola junto com a sidebar. */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <AppSidebar
          role={ctx.effectiveRole}
          userId={ctx.userId}
          email={ctx.email}
          fullName={ctx.fullName}
          avatarUrl={ctx.avatarUrl}
          profile={profile}
          initialNotifications={notifications}
          initialUnreadCount={unreadCount}
          showAdminSwitch={showAdminSwitch}
        />
        {/* `min-w-0` impede que tabela/código largo estoure a coluna e
            empurre a sidebar para fora da viewport. A chave "ver como" do
            admin fica fixa no canto superior direito (fora do fluxo da
            página) — sem essa reserva de espaço, botões de ação como "Nova
            turma"/"Nova tarefa" nascem embaixo dela. */}
        <main
          data-scroll-root
          className={cn(
            "bg-app-canvas min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-10 pt-6",
            showAdminSwitch ? "md:pl-8 md:pr-56" : "md:px-8",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
