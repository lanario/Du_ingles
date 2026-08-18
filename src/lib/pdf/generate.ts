import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { SessionPdfDocument } from "@/lib/pdf/session-pdf-document";
import type { JSONContent } from "@tiptap/react";

/**
 * Núcleo do pipeline de PDF (§8.4), compartilhado entre o Route Handler
 * (POST /api/sessions/[id]/pdf, chamado manualmente) e `endSessionAction`
 * (disparado via `after()` do Next.js ao encerrar a aula, sem travar a UI
 * do professor). Nunca seleciona `teacher_notes`.
 */
export async function generateSessionPdf(
  sessionId: string,
): Promise<{ success: boolean; path?: string }> {
  const admin = createAdminSupabaseClient();
  const { data: session, error } = await admin
    .from("class_sessions")
    .select(
      "id, title, scheduled_at, content, homework, organization_id, group_id, group:group_id(name)",
    )
    .eq("id", sessionId)
    .single();

  if (error || !session) return { success: false };

  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", session.organization_id)
    .single();

  const buffer = await renderToBuffer(
    SessionPdfDocument({
      schoolName: org?.name ?? "Du Inglês",
      groupName: session.group?.name ?? "",
      sessionTitle: session.title,
      scheduledAt: session.scheduled_at,
      content: session.content as JSONContent,
      homework: session.homework,
    }),
  );

  const path = `${session.organization_id}/${session.group_id}/${session.id}/${crypto.randomUUID()}-aula.pdf`;

  const { error: uploadError } = await admin.storage
    .from("session-pdfs")
    .upload(path, buffer, { contentType: "application/pdf", upsert: false });

  if (uploadError) return { success: false };

  await admin
    .from("class_sessions")
    .update({ pdf_path: path, pdf_generated_at: new Date().toISOString() })
    .eq("id", sessionId);

  return { success: true, path };
}
