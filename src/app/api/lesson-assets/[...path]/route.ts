import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { getLessonAssetUrl } from "@/lib/lesson-assets";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

/**
 * Serve uma imagem de aula. O caminho começa sempre pelo id da organização
 * (`orgId/escopo/arquivo`), então comparar o primeiro segmento com a sessão
 * já garante que ninguém lê o material de outra escola — e o arquivo em si
 * nunca fica exposto: o que sai daqui é um redirect para uma signed URL de
 * 5 minutos.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { path } = await params;
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const [organizationId] = path;
  if (!organizationId || organizationId !== ctx.organizationId) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const signedUrl = await getLessonAssetUrl(path.join("/"));
  if (!signedUrl) {
    return NextResponse.json({ error: "Imagem não encontrada." }, { status: 404 });
  }

  return NextResponse.redirect(signedUrl, {
    status: 307,
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
