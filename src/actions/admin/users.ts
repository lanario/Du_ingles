"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit";
import * as usersService from "@/services/users";
import {
  updateUserSchema,
  changeUserRoleSchema,
  adminSetPasswordSchema,
} from "@/schemas/users";
import { fail, ok, type ActionResult } from "@/types/action-result";
import type { AppRole } from "@/types/domain";

export async function updateUserAction(
  userId: string,
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);

  const parsed = updateUserSchema.safeParse({
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

  const result = await usersService.updateUser(userId, parsed.data);
  if (!result.success) return fail("INTERNAL_ERROR", result.message);

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "USER_UPDATE",
    entityType: "profile",
    entityId: userId,
  });

  revalidatePath(`/admin/usuarios/${userId}`);
  return ok(undefined as never);
}

export async function deactivateUserAction(userId: string): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);
  try {
    usersService.assertNotSelf(ctx.userId, userId);
  } catch (e) {
    return fail("FORBIDDEN", e instanceof Error ? e.message : "Ação não permitida.");
  }

  const result = await usersService.deactivateUser(userId);
  if (!result.success) return fail("INTERNAL_ERROR", result.message);

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "USER_DEACTIVATE",
    entityType: "profile",
    entityId: userId,
  });

  revalidatePath("/admin/usuarios");
  revalidatePath(`/admin/usuarios/${userId}`);
  return ok(undefined as never);
}

export async function reactivateUserAction(userId: string): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);

  const result = await usersService.reactivateUser(userId);
  if (!result.success) return fail("INTERNAL_ERROR", result.message);

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "USER_REACTIVATE",
    entityType: "profile",
    entityId: userId,
  });

  revalidatePath("/admin/usuarios");
  revalidatePath(`/admin/usuarios/${userId}`);
  return ok(undefined as never);
}

export async function softDeleteUserAction(userId: string): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);
  try {
    usersService.assertNotSelf(ctx.userId, userId);
  } catch (e) {
    return fail("FORBIDDEN", e instanceof Error ? e.message : "Ação não permitida.");
  }

  const result = await usersService.softDeleteUser(userId);
  if (!result.success) return fail("INTERNAL_ERROR", result.message);

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "USER_SOFT_DELETE",
    entityType: "profile",
    entityId: userId,
  });

  revalidatePath("/admin/usuarios");
  return ok(undefined as never);
}

export async function changeUserRoleAction(
  userId: string,
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);
  try {
    usersService.assertNotSelf(ctx.userId, userId);
  } catch (e) {
    return fail("FORBIDDEN", e instanceof Error ? e.message : "Ação não permitida.");
  }

  const parsed = changeUserRoleSchema.safeParse({ role: formData.get("role") });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Papel inválido.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const result = await usersService.changeUserRole(userId, parsed.data.role as AppRole);
  if (!result.success) return fail("INTERNAL_ERROR", result.message);

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "USER_ROLE_CHANGE",
    entityType: "profile",
    entityId: userId,
    metadata: { newRole: parsed.data.role },
  });

  revalidatePath(`/admin/usuarios/${userId}`);
  return ok(undefined as never);
}

/**
 * Define uma senha provisória para um professor ou aluno. `requireRole`
 * já barra quem não é admin; o serviço barra o alvo admin.
 */
export async function setUserPasswordAction(
  userId: string,
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);
  if (ctx.realRole !== "admin") {
    return fail("FORBIDDEN", "Apenas administradores podem redefinir senhas.");
  }

  const parsed = adminSetPasswordSchema.safeParse({
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

  const result = await usersService.setUserPassword(
    ctx.organizationId,
    userId,
    parsed.data.password,
  );
  if (!result.success) return fail("FORBIDDEN", result.message);

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "USER_PASSWORD_RESET",
    entityType: "profile",
    entityId: userId,
  });

  revalidatePath("/admin/usuarios");
  revalidatePath(`/admin/usuarios/${userId}`);
  return ok(undefined as never);
}
