import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { uploadLessonImage } from "@/lib/lesson-assets";

export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Upload da imagem colada no canvas. É uma rota, e não uma Server Action, por
 * dois motivos práticos: o binário sobe como binário (base64 numa action
 * cresce 33% e ainda esbarra no limite de corpo das actions), e uma aba com
 * bundle antigo continua funcionando — o id de action muda a cada build, a
 * URL não. Era exatamente esse o "enviando imagem…" que não terminava.
 */
export async function POST(request: Request) {
  const ctx = await requireRole(["admin"]);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
  }

  const file = form.get("file");
  const scope = String(form.get("scope") ?? "geral");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo ausente." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Imagem muito grande (máximo 4 MB)." },
      { status: 413 },
    );
  }

  const result = await uploadLessonImage(
    ctx.organizationId,
    scope,
    await file.arrayBuffer(),
    file.type,
  );

  if (!result.asset) {
    return NextResponse.json(
      { error: result.error ?? "Falha ao enviar a imagem." },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: result.asset.url });
}
