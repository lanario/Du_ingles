"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSignedPdfUrl } from "@/lib/storage";
import { getSessionContext } from "@/lib/auth/session";
import { fail, ok, type ActionResult } from "@/types/action-result";

/**
 * A leitura de `pdf_path` passa pela RLS normal de `class_sessions`
 * (professor dono, aluno com sessão publicada, ou admin) — se a linha nem
 * aparece, não há como pedir a signed URL. TTL de 60s (§6): gerada sob
 * demanda, nunca cacheada no cliente.
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

  const url = await getSignedPdfUrl(session.pdf_path);
  if (!url) return fail("INTERNAL_ERROR", "Falha ao gerar o link de download.");

  return ok(url);
}
