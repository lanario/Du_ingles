import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit";
import {
  AVATAR_MAX_BYTES,
  AVATAR_MAX_MB,
  avatarPublicPath,
  deleteAvatar,
  uploadAvatar,
} from "@/lib/avatars";
import { getProfileAvatarPath, setProfileAvatar } from "@/repositories/users";

export const runtime = "nodejs";

/**
 * Troca a foto do próprio usuário. É rota e não Server Action pelo mesmo
 * motivo do upload do planejador: o binário sobe como binário (base64 numa
 * action cresce 33%) e a URL não muda a cada build.
 *
 * Um admin pode enviar a foto de outra pessoa passando `userId` — é o que a
 * tela `/admin/usuarios/[id]` usa.
 */
export async function POST(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
  }

  const file = form.get("file");
  const target = String(form.get("userId") ?? "") || ctx.userId;

  if (target !== ctx.userId && ctx.realRole !== "admin") {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo ausente." }, { status: 400 });
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return NextResponse.json(
      { error: `Imagem muito grande (máximo ${AVATAR_MAX_MB} MB).` },
      { status: 413 },
    );
  }

  const result = await uploadAvatar(
    ctx.organizationId,
    target,
    await file.arrayBuffer(),
    file.type,
  );
  if (!result.avatar) {
    return NextResponse.json(
      { error: result.error ?? "Falha ao enviar a imagem." },
      { status: 500 },
    );
  }

  const previous = await getProfileAvatarPath(target);
  const saved = await setProfileAvatar(target, result.avatar.path);
  if (!saved) {
    // O arquivo subiu mas o perfil não aponta para ele: apagar evita órfão.
    await deleteAvatar(result.avatar.path);
    return NextResponse.json({ error: "Falha ao salvar a foto." }, { status: 500 });
  }
  if (previous && previous !== result.avatar.path) await deleteAvatar(previous);

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "PROFILE_AVATAR_UPDATE",
    entityType: "profile",
    entityId: target,
  });

  revalidatePath("/", "layout");

  return NextResponse.json({ url: avatarPublicPath(result.avatar.path) });
}
