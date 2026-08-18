import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const SIGNED_URL_TTL_SECONDS = 60;

/** Nenhum bucket de conteúdo pedagógico é público — só signed URL de curta duração (§6). */
export async function getSignedPdfUrl(path: string): Promise<string | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.storage
    .from("session-pdfs")
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data) return null;
  return data.signedUrl;
}
