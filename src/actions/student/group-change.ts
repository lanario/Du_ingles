"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit";
import { getGroupTeacherId } from "@/repositories/groups";
import { listStudentEnrollments } from "@/repositories/enrollments";
import { createNotification } from "@/repositories/notifications";
import { groupChangeRequestSchema } from "@/schemas/enrollments";
import { fail, ok, type ActionResult } from "@/types/action-result";

/**
 * O aluno **pede** a troca; quem move é o professor da turma de destino.
 * Deixar o aluno escrever direto em `enrollments` significaria abrir a
 * tabela para escrita pelo próprio matriculado — ele poderia se colocar em
 * qualquer turma, furando lotação e alocação de professor.
 */
export async function requestGroupChangeAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["student"]);

  const parsed = groupChangeRequestSchema.safeParse({
    enrollmentId: formData.get("enrollmentId"),
    toGroupId: formData.get("toGroupId"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }

  // A matrícula precisa ser do próprio aluno — o id vem do formulário.
  const enrollments = await listStudentEnrollments(ctx.userId);
  const current = enrollments.find(
    (e) => e.id === parsed.data.enrollmentId && e.status === "active",
  );
  if (!current) return fail("FORBIDDEN", "Matrícula não encontrada.");
  if (current.groupId === parsed.data.toGroupId)
    return fail("CONFLICT", "Você já está nesta turma.");

  const teacherId = await getGroupTeacherId(parsed.data.toGroupId);
  if (!teacherId) return fail("NOT_FOUND", "Turma de destino não encontrada.");

  const sent = await createNotification({
    organizationId: ctx.organizationId,
    recipientId: teacherId,
    type: "GROUP_CHANGE_REQUEST",
    title: "Pedido de troca de turma",
    body: parsed.data.reason
      ? `${ctx.email} pediu para mudar de turma: ${parsed.data.reason}`
      : `${ctx.email} pediu para mudar de turma.`,
    link: "/turmas",
  });
  if (!sent) return fail("INTERNAL_ERROR", "Falha ao enviar o pedido.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "GROUP_CHANGE_REQUEST",
    entityType: "group",
    entityId: parsed.data.toGroupId,
    metadata: {
      enrollmentId: parsed.data.enrollmentId,
      fromGroupId: current.groupId,
    },
  });

  revalidatePath("/turmas");
  return ok(undefined as never);
}
