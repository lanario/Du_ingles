import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { generateSessionPdf } from "@/lib/pdf/generate";

// react-pdf usa APIs de Node (Buffer, fontkit) — não roda no Edge Runtime.
export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Regeneração manual do PDF (ex.: professor corrigiu um erro de digitação
 * depois de encerrar a aula). A geração automática ao encerrar usa
 * `generateSessionPdf` direto via `after()`, sem passar por aqui. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: sessionId } = await params;
  const ctx = await requireRole(["teacher", "admin"]);

  const admin = createAdminSupabaseClient();
  const { data: session } = await admin
    .from("class_sessions")
    .select("teacher_id")
    .eq("id", sessionId)
    .single();

  if (!session) {
    return NextResponse.json({ error: "Sessão não encontrada." }, { status: 404 });
  }
  if (ctx.realRole !== "admin" && session.teacher_id !== ctx.userId) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const result = await generateSessionPdf(sessionId);
  if (!result.success) {
    return NextResponse.json({ error: "Falha ao gerar o PDF." }, { status: 500 });
  }

  return NextResponse.json({ success: true, path: result.path });
}
