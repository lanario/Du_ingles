"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit";
import { createGroup } from "@/repositories/groups";
import { enrollStudent, unenrollStudent } from "@/repositories/enrollments";
import { createGroupSchema } from "@/schemas/groups";
import { createEnrollmentSchema } from "@/schemas/enrollments";
import { fail, ok, type ActionResult } from "@/types/action-result";

export async function createGroupAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);
  if (ctx.isViewAs)
    return fail("READ_ONLY_MODE", "Modo de visualização é somente leitura.");

  const parsed = createGroupSchema.safeParse({
    name: formData.get("name"),
    courseId: formData.get("courseId"),
    teacherId: formData.get("teacherId"),
    level: formData.get("level"),
    maxStudents: formData.get("maxStudents") || undefined,
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    schedule: formData.get("schedule") || "[]",
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const result = await createGroup(parsed.data, ctx.organizationId);
  if (!result.success)
    return fail("INTERNAL_ERROR", result.message ?? "Falha ao criar turma.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "GROUP_CREATE",
    entityType: "group",
    entityId: result.groupId,
  });

  revalidatePath("/admin/turmas");
  redirect(`/admin/turmas/${result.groupId}`);
}

export async function enrollStudentAction(
  groupId: string,
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);
  if (ctx.isViewAs)
    return fail("READ_ONLY_MODE", "Modo de visualização é somente leitura.");

  const parsed = createEnrollmentSchema.safeParse({
    studentId: formData.get("studentId"),
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Selecione um aluno.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const result = await enrollStudent(groupId, parsed.data.studentId, ctx.organizationId);
  if (!result.success) return fail("CONFLICT", result.message ?? "Falha ao matricular.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "ENROLLMENT_CREATE",
    entityType: "group",
    entityId: groupId,
    metadata: { studentId: parsed.data.studentId },
  });

  revalidatePath(`/admin/turmas/${groupId}`);
  return ok(undefined as never);
}

export async function unenrollStudentAction(
  groupId: string,
  enrollmentId: string,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);
  if (ctx.isViewAs)
    return fail("READ_ONLY_MODE", "Modo de visualização é somente leitura.");

  const success = await unenrollStudent(enrollmentId);
  if (!success) return fail("INTERNAL_ERROR", "Falha ao remover matrícula.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "ENROLLMENT_CANCEL",
    entityType: "group",
    entityId: groupId,
    metadata: { enrollmentId },
  });

  revalidatePath(`/admin/turmas/${groupId}`);
  return ok(undefined as never);
}
