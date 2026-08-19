"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit";
import { enrollStudent, transferStudent, unenrollStudent } from "@/repositories/enrollments";
import { fail, ok, type ActionResult } from "@/types/action-result";

/**
 * Move um aluno para outra turma (ou tira da turma, com `toGroupId: null`) —
 * usada pela barra de turmas e pelo painel de detalhe em `/admin/alunos`.
 * Resolve sozinha qual das três operações de `repositories/enrollments.ts`
 * cabe: matricular (sem matrícula ativa), transferir (já matriculado) ou
 * cancelar (destino nulo).
 */
export async function moveStudentToGroupAction(
  studentId: string,
  currentEnrollmentId: string | null,
  toGroupId: string | null,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);

  if (toGroupId === null) {
    if (!currentEnrollmentId) return ok(undefined as never);

    const success = await unenrollStudent(currentEnrollmentId);
    if (!success) return fail("INTERNAL_ERROR", "Falha ao remover o aluno da turma.");

    await auditLog({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      actorRole: ctx.realRole,
      action: "ENROLLMENT_CANCEL",
      entityType: "profile",
      entityId: studentId,
      metadata: { enrollmentId: currentEnrollmentId },
    });

    revalidatePath("/admin/alunos");
    return ok(undefined as never);
  }

  if (!currentEnrollmentId) {
    const result = await enrollStudent(toGroupId, studentId, ctx.organizationId);
    if (!result.success) return fail("CONFLICT", result.message ?? "Falha ao matricular.");

    await auditLog({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      actorRole: ctx.realRole,
      action: "ENROLLMENT_CREATE",
      entityType: "group",
      entityId: toGroupId,
      metadata: { studentId },
    });

    revalidatePath("/admin/alunos");
    return ok(undefined as never);
  }

  const result = await transferStudent(currentEnrollmentId, toGroupId);
  if (!result.success) return fail("CONFLICT", result.message ?? "Falha ao transferir.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "ENROLLMENT_TRANSFER",
    entityType: "group",
    entityId: toGroupId,
    metadata: { studentId, enrollmentId: currentEnrollmentId },
  });

  revalidatePath("/admin/alunos");
  revalidatePath("/admin/turmas");
  return ok(undefined as never);
}
