import { NextResponse, type NextRequest } from "next/server";
import { getSessionContext, requireRole } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateSessionPdf } from "@/lib/pdf/generate";
import { downloadSessionPdf } from "@/lib/storage";

// react-pdf usa APIs de Node (Buffer, fontkit) — não roda no Edge Runtime.
export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** `Ingles B1 — Past Perfect` + 2026-08-22 → `ingles-b1-past-perfect-2026-08-22`. */
function fileNameFor(title: string, scheduledAt: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const date = scheduledAt.slice(0, 10);
  return `${slug || "aula"}-${date}.pdf`;
}

/**
 * Entrega o PDF da aula pelo domínio da escola. O arquivo é lido do storage
 * aqui dentro e sai no corpo da resposta — em vez do redirect para signed URL
 * que avatares e imagens de aula usam, porque ali o endereço do Supabase
 * acabaria visível na barra do navegador.
 *
 * A permissão é a RLS de `class_sessions`, não uma regra reescrita à mão: se
 * a linha não aparece para quem pediu (aluno sem matrícula, aula ainda não
 * publicada, outra escola), não há `pdf_path` para baixar. Por isso a leitura
 * usa o cliente da sessão e só o download usa a chave de serviço.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id: sessionId } = await params;

  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

  const supabase = await createServerSupabaseClient();
  const { data: session } = await supabase
    .from("class_sessions")
    .select("pdf_path, title, scheduled_at")
    .eq("id", sessionId)
    .single();

  if (!session?.pdf_path) {
    return NextResponse.json(
      { error: "PDF ainda não disponível para esta aula." },
      { status: 404 },
    );
  }

  const file = await downloadSessionPdf(session.pdf_path);
  if (!file) {
    return NextResponse.json({ error: "Falha ao ler o arquivo." }, { status: 500 });
  }

  const name = fileNameFor(session.title, session.scheduled_at);

  return new NextResponse(file, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(file.size),
      // `inline`: abre no visualizador do navegador, como antes — o que muda
      // é só o endereço. Trocar para `attachment` força o download direto.
      "Content-Disposition": `inline; filename="${name}"`,
      // Material de aula é privado: nada de cache compartilhado, e o
      // navegador precisa reconferir a sessão a cada pedido.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
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
