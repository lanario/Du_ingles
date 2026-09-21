import { NextResponse, type NextRequest } from "next/server";
import { getSessionContext, isAdmin } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  readAnswerKey,
  readInstructionsText,
  readQuestions,
} from "@/lib/assignments/exercises";
import {
  assignmentPdfResponse,
  schoolNameOf,
  todayLabel,
} from "@/lib/pdf/assignment-pdf";

// react-pdf usa APIs de Node (Buffer, fontkit) — não roda no Edge Runtime.
export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Folha de exercícios de uma tarefa padrão do ateliê (ainda sem turma).
 *
 * Só staff. Leitura com service-role filtrada pela escola; quem pode ver é
 * quem a estante do ateliê mostra: o dono, qualquer professor se ela estiver
 * compartilhada, ou o admin.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  if (!isAdmin(ctx) && ctx.realRole !== "teacher") {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const admin = createAdminSupabaseClient();
  const { data: template } = await admin
    .from("assignment_templates")
    .select(
      "owner_id, is_shared, title, instructions, answer_key, owner:owner_id(full_name)",
    )
    .eq("id", id)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  const allowed =
    template && (isAdmin(ctx) || template.owner_id === ctx.userId || template.is_shared);
  if (!allowed) {
    return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
  }

  const wantsKey = request.nextUrl.searchParams.get("gabarito") === "1";

  return assignmentPdfResponse({
    schoolName: await schoolNameOf(ctx.organizationId),
    title: template.title,
    // Ainda sem turma: quem assina é o dono da tarefa padrão, e a data é a
    // de hoje (não há prazo antes de atribuir).
    groupName: null,
    teacherName: template.owner?.full_name || null,
    studentName: null,
    dateLabel: todayLabel(),
    instructions: readInstructionsText(template.instructions),
    questions: readQuestions(template.instructions),
    answerKey: wantsKey ? readAnswerKey(template.answer_key) : undefined,
  });
}
