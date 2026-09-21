import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  LessonPlanPdfDocument,
  SessionPdfDocument,
} from "@/lib/pdf/session-pdf-document";
import type { PlannerPlanDetail } from "@/repositories/lesson-planner";
import { registerPdfFonts } from "@/lib/pdf/fonts";
import { attachImages, stripEmoji } from "@/lib/pdf/assets";
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
      "id, title, scheduled_at, content, homework, organization_id, group_id, group:group_id(name), teacher:teacher_id(full_name)",
    )
    .eq("id", sessionId)
    .single();

  if (error || !session) return { success: false };

  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", session.organization_id)
    .single();

  registerPdfFonts();

  // As imagens da aula são caminhos relativos numa rota autenticada: precisam
  // ser lidas do Storage aqui, antes do render (ver `assets.ts`).
  const content = await attachImages(
    (session.content ?? { type: "doc", content: [] }) as JSONContent,
    session.organization_id,
  );

  const buffer = await renderLessonSheet(content, (doc) =>
    SessionPdfDocument({
      schoolName: org?.name ?? "Du Inglês",
      groupName: session.group?.name ?? "",
      teacherName: session.teacher?.full_name || null,
      sessionTitle: session.title,
      scheduledAt: session.scheduled_at,
      content: doc,
      homework: session.homework,
    }),
  );
  if (!buffer) return { success: false };

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

/**
 * Render da folha de aula com o plano B do emoji: os emojis vêm de um CDN no
 * momento do render; se ele estiver fora do ar é melhor um PDF sem emoji do
 * que nenhum PDF.
 */
async function renderLessonSheet(
  content: JSONContent,
  build: (doc: JSONContent) => Parameters<typeof renderToBuffer>[0],
): Promise<Buffer | null> {
  try {
    return await renderToBuffer(build(content));
  } catch (error) {
    console.error("[pdf] falha no render, tentando sem emojis:", error);
    try {
      return await renderToBuffer(build(stripEmoji(content)));
    } catch (retryError) {
      console.error("[pdf] falha ao gerar o PDF:", retryError);
      return null;
    }
  }
}

/**
 * PDF do plano de aula do ateliê, sob demanda (não vai para o Storage: o
 * plano muda a cada autosave, e o arquivo tem que refletir a versão atual).
 * Quem chama já conferiu que o usuário pode ver o plano.
 */
export async function renderLessonPlanPdf(
  plan: PlannerPlanDetail,
  organizationId: string,
  schoolName: string,
): Promise<Buffer | null> {
  registerPdfFonts();
  const content = await attachImages(
    (plan.content ?? { type: "doc", content: [] }) as JSONContent,
    organizationId,
  );
  return renderLessonSheet(content, (doc) =>
    LessonPlanPdfDocument({
      schoolName,
      title: plan.title,
      summary: plan.summary,
      level: plan.level,
      durationMinutes: plan.durationMinutes,
      authorName: plan.authorName,
      content: doc,
    }),
  );
}
