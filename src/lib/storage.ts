import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * Nenhum bucket de conteúdo pedagógico é público (§6). O arquivo é lido aqui,
 * no servidor, com a chave de serviço — e servido ao aluno pela rota
 * `/api/sessions/[id]/pdf`, que reaplica a permissão. Assim o endereço do
 * Supabase nunca chega ao navegador: o que o aluno vê na barra é o domínio
 * da escola.
 */
export async function downloadSessionPdf(path: string): Promise<Blob | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.storage.from("session-pdfs").download(path);

  if (error || !data) return null;
  return data;
}
