import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { getAvatarSignedUrl } from "@/lib/avatars";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

/**
 * Serve a foto de perfil. O caminho começa pelo id da organização
 * (`orgId/userId/arquivo`), então comparar o primeiro segmento com a sessão já
 * garante que ninguém vê o retrato de gente de outra escola. Dentro da mesma
 * organização a foto é visível para qualquer pessoa autenticada — é o que
 * aparece no chat, na lista de turma e nos cartões de aluno.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { path } = await params;
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const [organizationId] = path;
  if (!organizationId || organizationId !== ctx.organizationId) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const signedUrl = await getAvatarSignedUrl(path.join("/"));
  if (!signedUrl) {
    return NextResponse.json({ error: "Imagem não encontrada." }, { status: 404 });
  }

  return NextResponse.redirect(signedUrl, {
    status: 307,
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
