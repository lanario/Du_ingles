import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { listUsers } from "@/repositories/users";
import { UsersView } from "@/components/features/admin/users/users-view";
import { APP_ROLES, type AppRole } from "@/types/domain";

export const metadata: Metadata = { title: "Usuários" };

interface PageProps {
  searchParams: Promise<{ convite?: string }>;
}

export default async function UsuariosPage({ searchParams }: PageProps) {
  const ctx = await requireRole(["admin"]);
  const { convite } = await searchParams;

  // A busca e as abas de papel são locais (ver `UsersView`): a organização
  // inteira já cabe numa página e filtrar em memória é imediato.
  const users = await listUsers(ctx.organizationId, { includeInactive: true });

  // `?convite=` abre o painel já aberto: é como "Novo aluno" (em /admin/alunos)
  // e a rota antiga /admin/usuarios/novo chegam até aqui. `?convite=1` só abre;
  // `?convite=student` também deixa o papel pré-selecionado.
  const inviteRole = APP_ROLES.includes(convite as AppRole)
    ? (convite as AppRole)
    : undefined;

  return (
    <UsersView
      users={users}
      myUserId={ctx.userId}
      openInvite={convite !== undefined}
      {...(inviteRole ? { inviteRole } : {})}
    />
  );
}
