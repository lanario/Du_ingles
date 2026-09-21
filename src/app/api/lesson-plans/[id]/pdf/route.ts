import { NextResponse, type NextRequest } from "next/server";
import { getSessionContext, isAdmin } from "@/lib/auth/session";
import { getPlannerPlan } from "@/repositories/lesson-planner";
import { renderLessonPlanPdf } from "@/lib/pdf/generate";
import { schoolNameOf } from "@/lib/pdf/assignment-pdf";
import { pdfResponse, pdfSlug } from "@/lib/pdf/response";

// react-pdf usa APIs de Node (Buffer, fontkit) — não roda no Edge Runtime.
export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Plano de aula do ateliê em PDF. Mesmo recorte das páginas do planejador:
 * admin vê qualquer plano da escola; professor, os dele e os compartilhados.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  if (!isAdmin(ctx) && ctx.realRole !== "teacher") {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const plan = await getPlannerPlan(id, ctx.organizationId);
  if (!plan || (!isAdmin(ctx) && plan.authorId !== ctx.userId && !plan.isShared)) {
    return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });
  }

  const buffer = await renderLessonPlanPdf(
    plan,
    ctx.organizationId,
    await schoolNameOf(ctx.organizationId),
  );
  if (!buffer) {
    return NextResponse.json({ error: "Falha ao gerar o PDF." }, { status: 500 });
  }

  return pdfResponse(buffer, `${pdfSlug(plan.title, "plano-de-aula")}.pdf`);
}
