import * as usersRepo from "@/repositories/users";
import type { AppRole } from "@/types/domain";
import type { CreateUserInput, UpdateUserInput } from "@/schemas/users";

export type ServiceResult<T> =
  { success: true; data: T } | { success: false; message: string };

export async function createUser(
  input: CreateUserInput,
  organizationId: string,
): Promise<ServiceResult<{ userId: string; tempPassword: string }>> {
  const result = await usersRepo.createUser(input, organizationId);
  if (!result.success) return { success: false, message: result.message };
  return {
    success: true,
    data: { userId: result.userId, tempPassword: result.tempPassword },
  };
}

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
