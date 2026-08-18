"use server";

import { revalidatePath } from "next/cache";
import { requireRole, type SessionContext } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit";
import * as usersService from "@/services/users";
import {
  createUserSchema,
  updateUserSchema,
  changeUserRoleSchema,
} from "@/schemas/users";
import { fail, ok, type ActionResult } from "@/types/action-result";
import type { AppRole } from "@/types/domain";

/** `assertNotViewAs` lança — Server Actions nunca deixam throw cru chegar
 * ao cliente (§2.2), então aqui a checagem vira um retorno de ActionResult. */
function blockIfViewAs(ctx: SessionContext): ActionResult<never> | null {
  if (ctx.isViewAs) {
    return fail("READ_ONLY_MODE", "Modo de visualização é somente leitura.");
  }
  return null;
}

export async function createUserAction(
  _prev: ActionResult<{ tempPassword: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ tempPassword: string }>> {
  const ctx = await requireRole(["admin"]);
  const viewAsBlock = blockIfViewAs(ctx);
  if (viewAsBlock) return viewAsBlock;

  const parsed = createUserSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    birthDate: formData.get("birthDate"),
    role: formData.get("role"),
    bio: formData.get("bio"),
    isPublic: formData.get("isPublic") === "on",
    guardianName: formData.get("guardianName"),
    guardianEmail: formData.get("guardianEmail"),
    guardianPhone: formData.get("guardianPhone"),
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const result = await usersService.createUser(parsed.data, ctx.organizationId);
  if (!result.success) {
    return fail("INTERNAL_ERROR", result.message);
  }

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "USER_CREATE",
    entityType: "profile",
    entityId: result.data.userId,
    metadata: { role: parsed.data.role },
  });

  revalidatePath("/admin/usuarios");
  return ok({ tempPassword: result.data.tempPassword });
}

export async function updateUserAction(
  userId: string,
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);
  const viewAsBlock = blockIfViewAs(ctx);
  if (viewAsBlock) return viewAsBlock;

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
  const viewAsBlock = blockIfViewAs(ctx);
  if (viewAsBlock) return viewAsBlock;
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
  const viewAsBlock = blockIfViewAs(ctx);
  if (viewAsBlock) return viewAsBlock;

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
  const viewAsBlock = blockIfViewAs(ctx);
  if (viewAsBlock) return viewAsBlock;
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
  const viewAsBlock = blockIfViewAs(ctx);
  if (viewAsBlock) return viewAsBlock;
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
