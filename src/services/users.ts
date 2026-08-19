import * as usersRepo from "@/repositories/users";
import type { AppRole } from "@/types/domain";
import type { UpdateUserInput } from "@/schemas/users";

export type ServiceResult<T> =
  { success: true; data: T } | { success: false; message: string };

export async function updateUser(
  id: string,
  input: UpdateUserInput,
): Promise<ServiceResult<void>> {
  const ok = await usersRepo.updateUserProfile(id, input);
  if (!ok) return { success: false, message: "Falha ao atualizar o usuário." };
  return { success: true, data: undefined };
}

/** Admin não pode desativar/excluir/rebaixar a própria conta pela UI — evita autobloqueio acidental. */
export function assertNotSelf(actorId: string, targetId: string): void {
  if (actorId === targetId) {
    throw new Error("Você não pode executar esta ação na sua própria conta.");
  }
}

export async function deactivateUser(id: string): Promise<ServiceResult<void>> {
  const ok = await usersRepo.setUserActive(id, false);
  if (!ok) return { success: false, message: "Falha ao desativar o usuário." };
  await usersRepo.revokeUserSessions(id);
  return { success: true, data: undefined };
}

export async function reactivateUser(id: string): Promise<ServiceResult<void>> {
  const ok = await usersRepo.setUserActive(id, true);
  if (!ok) return { success: false, message: "Falha ao reativar o usuário." };
  return { success: true, data: undefined };
}

export async function softDeleteUser(id: string): Promise<ServiceResult<void>> {
  const ok = await usersRepo.softDeleteUser(id);
  if (!ok) return { success: false, message: "Falha ao excluir o usuário." };
  await usersRepo.revokeUserSessions(id);
  return { success: true, data: undefined };
}

export async function changeUserRole(
  id: string,
  role: AppRole,
): Promise<ServiceResult<void>> {
  const ok = await usersRepo.changeUserRole(id, role);
  if (!ok) return { success: false, message: "Falha ao alterar o papel do usuário." };
  // Claim `app_role` só é atualizada na renovação do token — sem revogar a
  // sessão, o usuário continuaria agindo com o papel antigo até o refresh (§3.1).
  await usersRepo.revokeUserSessions(id);
  return { success: true, data: undefined };
}

/**
 * Redefinição de senha pelo admin. A regra do produto é estreita de
 * propósito: o admin troca a senha de professores e alunos, e de mais
 * ninguém. Contas admin — inclusive a dele — ficam de fora, senão um admin
 * poderia tomar a conta de outro (e a própria já tem o fluxo de
 * "esqueci minha senha"). A checagem mora aqui, junto da regra, e não só na
 * UI: qualquer chamada da action precisa passar por ela.
 */
export async function setUserPassword(
  actorOrganizationId: string,
  targetId: string,
  password: string,
): Promise<ServiceResult<void>> {
  const target = await usersRepo.getUserRoleAndOrg(targetId);
  if (!target) return { success: false, message: "Usuário não encontrado." };

  if (target.organizationId !== actorOrganizationId) {
    return { success: false, message: "Usuário não encontrado." };
  }

  if (target.role === "admin") {
    return {
      success: false,
      message:
        "A senha de um admin só pode ser alterada pelo próprio, pelo fluxo de recuperação.",
    };
  }

  const ok = await usersRepo.setUserPassword(targetId, password);
  if (!ok) return { success: false, message: "Falha ao redefinir a senha." };

  // Senha trocada por terceiro: derruba as sessões abertas para que ninguém
  // siga autenticado com a credencial antiga (§3.4).
  await usersRepo.revokeUserSessions(targetId);
  return { success: true, data: undefined };
}
