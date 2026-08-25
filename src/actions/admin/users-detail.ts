"use server";

import { canSeeStudent, requireStaff } from "@/lib/auth/staff";
import { getUserById, type UserDetail } from "@/repositories/users";

/**
 * Busca a ficha completa de um usuário para o painel lateral da listagem.
 * Fica separado de `actions/admin/users.ts` (que só tem mutações) porque
 * esta é uma leitura sob demanda, disparada pelo clique no cartão — não algo
 * que a página carrega de antemão para todo mundo.
 *
 * O professor também abre esse painel (em modo consulta, na área dele), mas
 * só de quem ele leciona: `getUserById` usa service-role, então o recorte
 * tem que ser feito aqui.
 */
export async function getUserByIdAction(userId: string): Promise<UserDetail | null> {
  const ctx = await requireStaff();
  if (!(await canSeeStudent(ctx, userId))) return null;
  return getUserById(userId);
}
