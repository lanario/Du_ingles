import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import {
  AdminSidebar,
  type AdminNavSection,
} from "@/components/features/admin/sidebar";
import {
  listNotifications,
  countUnreadNotifications,
} from "@/repositories/notifications";
import { getMyProfile } from "@/repositories/users";

/**
 * Área do professor: o mesmo chrome do painel administrativo (rail navy,
 * canvas claro) com um mapa de navegação recortado — turmas, alunos,
 * planejador e mensagens, que é o que quem dá aula opera.
 *
 * Não existe chave "ver como" aqui. Alternar de contexto é ferramenta de
 * coordenação (§3.3): o professor tem um papel só, e a área do aluno não é
 * uma lente que ele possa vestir.
 */
const TEACHER_NAV_SECTIONS: AdminNavSection[] = [
  {
    label: "Gestão",
    items: [
      { href: "/professor/alunos", label: "Alunos", icon: "graduation" },
      { href: "/professor/turmas", label: "Turmas", icon: "board" },
    ],
  },
  {
    label: "Operação",
    items: [
      { href: "/professor/planejador", label: "Planejador de aulas", icon: "lesson" },
      { href: "/professor/mensagens", label: "Mensagens", icon: "chat" },
    ],
  },
  {
    label: "Conta",
    items: [{ href: "/professor/meus-dados", label: "Meus dados", icon: "user" }],
  },
];

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  // O admin coordena pelo próprio painel — mandá-lo de volta evita duas
  // portas para a mesma tela (e um "voltar" que alterna entre elas).
  if (ctx.realRole === "admin") redirect("/admin");
  if (ctx.realRole !== "teacher") redirect("/403");

  const [notifications, unreadCount, profile] = await Promise.all([
    listNotifications(),
    countUnreadNotifications(),
    getMyProfile(ctx.userId),
  ]);

  return (
    <div
      data-admin-theme
      className="fixed inset-0 flex flex-col overflow-hidden bg-admin-background text-admin-foreground md:flex-row"
    >
      <AdminSidebar
        organizationLabel="Área do professor"
        userId={ctx.userId}
        email={ctx.email}
        fullName={ctx.fullName}
        avatarUrl={ctx.avatarUrl}
        profile={profile}
        initialNotifications={notifications}
        initialUnreadCount={unreadCount}
        sections={TEACHER_NAV_SECTIONS}
        rootHref="/professor"
        role="teacher"
        dataHref="/professor/meus-dados"
        showRoleSwitch={false}
        navLabel="Navegação do professor"
      />

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <main
          data-scroll-root
          className="bg-admin-canvas min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-5 md:px-6 md:pb-6 md:pt-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
