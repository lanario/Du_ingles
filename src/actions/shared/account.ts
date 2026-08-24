"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { deleteAvatar } from "@/lib/avatars";
import {
  getProfileAvatarPath,
  setProfileAvatar,
  updateUserProfile,
} from "@/repositories/users";
import { changeMyPasswordSchema, updateMyProfileSchema } from "@/schemas/account";
import { fail, ok, type ActionResult } from "@/types/action-result";

const ALL_ROLES = ["admin", "teacher", "student"] as const;

/**
 * Dados da própria conta. O upload da foto NÃO passa por aqui — binário vai
 * por `POST /api/avatars/upload` (ver o comentário lá).
 */
export async function updateMyProfileAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireRole([...ALL_ROLES]);
  if (ctx.isViewAs) {
    return fail("READ_ONLY_MODE", "Modo “ver como” é somente leitura.");
  }

  const parsed = updateMyProfileSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    birthDate: formData.get("birthDate"),
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const saved = await updateUserProfile(ctx.userId, parsed.data);
  if (!saved) return fail("INTERNAL_ERROR", "Não foi possível salvar seus dados.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "PROFILE_SELF_UPDATE",
    entityType: "profile",
    entityId: ctx.userId,
  });

  // O nome e a foto aparecem no menu da conta, que vive no layout.
  revalidatePath("/", "layout");
  return ok(undefined as never);
}

/** Volta às iniciais: limpa o perfil e apaga o arquivo. */
export async function removeMyAvatarAction(): Promise<ActionResult<never>> {
  const ctx = await requireRole([...ALL_ROLES]);
  if (ctx.isViewAs) {
    return fail("READ_ONLY_MODE", "Modo “ver como” é somente leitura.");
  }

  const previous = await getProfileAvatarPath(ctx.userId);
  const saved = await setProfileAvatar(ctx.userId, null);
  if (!saved) return fail("INTERNAL_ERROR", "Não foi possível remover a foto.");
  if (previous) await deleteAvatar(previous);

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "PROFILE_AVATAR_REMOVE",
    entityType: "profile",
    entityId: ctx.userId,
  });

  revalidatePath("/", "layout");
  return ok(undefined as never);
}

/**
 * Troca da própria senha. Revalida a senha atual com `signInWithPassword`
 * antes de aceitar a nova — o `updateUser` sozinho confia só no cookie de
 * sessão, o que tornaria uma sessão esquecida suficiente para tomar a conta.
 */
export async function changeMyPasswordAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireRole([...ALL_ROLES]);
  if (ctx.isViewAs) {
    return fail("READ_ONLY_MODE", "Modo “ver como” é somente leitura.");
  }

  const parsed = changeMyPasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const ip = await getClientIp();
  const allowed = await checkRateLimit(`${ip}:${ctx.userId}`, "change-password", 5, 900);
  if (!allowed) {
    return fail("RATE_LIMITED", "Muitas tentativas. Aguarde alguns minutos.");
  }

  const supabase = await createServerSupabaseClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: ctx.email,
    password: parsed.data.currentPassword,
  });
  if (signInError) {
    return fail("UNAUTHENTICATED", "Senha atual incorreta.", {
      currentPassword: ["Senha atual incorreta."],
    });
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return fail("INTERNAL_ERROR", "Não foi possível atualizar a senha.");
  }

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "PASSWORD_SELF_CHANGE",
    entityType: "profile",
    entityId: ctx.userId,
  });

  return ok(undefined as never);
}
