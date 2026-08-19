"use server";

import { requireRole } from "@/lib/auth/session";
import { getUserById, type UserDetail } from "@/repositories/users";

/**
 * Busca a ficha completa de um usuário para o painel lateral da listagem.
 * Fica separado de `actions/admin/users.ts` (que só tem mutações) porque
 * esta é uma leitura sob demanda, disparada pelo clique no cartão — não algo
 * que a página carrega de antemão para todo mundo.
 */
export async function getUserByIdAction(userId: string): Promise<UserDetail | null> {
  await requireRole(["admin"]);
  return getUserById(userId);
}
