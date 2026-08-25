"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { fail, ok, type ActionResult } from "@/types/action-result";

/**
 * Pré-checagem do botão de download: confirma que a aula é visível para quem
 * pediu (RLS normal de `class_sessions` — professor dono, aluno com sessão
 * publicada, ou admin) e que o PDF já existe, devolvendo o endereço no
 * domínio da escola.
 *
 * Quem entrega o arquivo é `GET /api/sessions/[id]/pdf`, que reaplica a mesma
 * permissão — esta action não é a tranca, é o que permite o botão dizer
 * "PDF em preparo" ou "sessão expirada" antes de abrir uma aba.
 */
export async function getSessionPdfUrlAction(
  sessionId: string,
): Promise<ActionResult<string>> {
  const ctx = await getSessionContext();
  if (!ctx) return fail("UNAUTHENTICATED", "Sessão expirada.");

  const supabase = await createServerSupabaseClient();
  const { data: session, error } = await supabase
    .from("class_sessions")
    .select("pdf_path")
    .eq("id", sessionId)
    .single();

  if (error || !session?.pdf_path) {
    return fail("NOT_FOUND", "PDF ainda não disponível para esta aula.");
  }

  return ok(`/api/sessions/${sessionId}/pdf`);
}
