"use server";

import { revalidatePath } from "next/cache";
import { isAdmin, requireRole } from "@/lib/auth/session";
import { revalidateStaffPath } from "@/lib/areas.server";
import { auditLog } from "@/lib/audit";
import { createGroup, isGroupOwnedByTeacher, updateGroup } from "@/repositories/groups";
import {
  enrollStudent,
  getActiveEnrollmentForStudent,
  transferStudent,
  unenrollStudent,
} from "@/repositories/enrollments";
import { createGroupFromAppSchema, updateGroupSchema } from "@/schemas/groups";
import { createEnrollmentSchema, transferEnrollmentSchema } from "@/schemas/enrollments";
import { fail, ok, type ActionResult } from "@/types/action-result";

/**
 * Turmas na área logada (`/turmas`). Professor só toca nas próprias; admin
 * não tem restrição nenhuma — `isAdmin(ctx)` pula toda checagem de posse,
 * porque para o admin "ver como" é uma lente sobre a UI, não um teto de
 * privilégio (§3.3 revisitado: o cookie de view-as nunca vira o JWT real).
 */
export async function createGroupAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["teacher"]);

  const parsed = createGroupFromAppSchema.safeParse({
    name: formData.get("name"),
    courseId: formData.get("courseId"),
    teacherId: formData.get("teacherId") || undefined,
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

  // Professor sempre cria para si; admin precisa ter escolhido um professor
  // no formulário (não existe turma sem responsável).
  const teacherId = isAdmin(ctx) ? parsed.data.teacherId : ctx.userId;
  if (!teacherId) {
    return fail("VALIDATION_ERROR", "Selecione um professor.", {
      teacherId: ["Selecione um professor."],
    });
  }

  const result = await createGroup({ ...parsed.data, teacherId }, ctx.organizationId);
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

  revalidatePath("/turmas");
  return ok(undefined as never);
}

export async function updateGroupAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["teacher"]);

  const groupId = formData.get("id");
  if (typeof groupId !== "string") return fail("VALIDATION_ERROR", "Turma inválida.");
  if (!isAdmin(ctx) && !(await isGroupOwnedByTeacher(groupId, ctx.userId)))
    return fail("FORBIDDEN", "Esta turma não é sua.");

  const parsed = updateGroupSchema.safeParse({
    id: groupId,
    name: formData.get("name"),
    courseId: formData.get("courseId"),
    teacherId: formData.get("teacherId") || undefined,
    level: formData.get("level"),
    maxStudents: formData.get("maxStudents") || undefined,
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    isActive: formData.get("isActive") === "on",
    // Vazio = "não editei os horários" (schedule some do FormData quando o
    // builder não está montado na edição rápida do admin).
    schedule: formData.has("schedule") ? formData.get("schedule") : undefined,
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }

  // Só admin reatribui o professor responsável — trocar de dono é decisão
  // de coordenação, não algo que o próprio professor faz na própria tela.
  const input = isAdmin(ctx) ? parsed.data : { ...parsed.data, teacherId: undefined };

  const result = await updateGroup(input);
  if (!result.success)
    return fail("INTERNAL_ERROR", result.message ?? "Falha ao salvar a turma.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "GROUP_UPDATE",
    entityType: "group",
    entityId: groupId,
    // Ids no primeiro nível de propósito: é assim que a auditoria os troca
    // por nomes na leitura (`collectMetadataIds` não desce em objetos).
    ...(result.handover
      ? {
          metadata: {
            newTeacherId: input.teacherId ?? null,
            previousTeacherId: result.handover.previousTeacherId,
            handedOverSessions: result.handover.sessions,
          },
        }
      : {}),
  });

  revalidatePath("/turmas");
  // A turma mudou de dono: as aulas futuras saíram de uma agenda e entraram
  // na outra, então as duas telas de agenda estão servindo cache velho.
  if (result.handover) {
    revalidateStaffPath("/planejador");
    revalidateStaffPath("/agenda");
  }
  return ok(undefined as never);
}

/**
 * Um aluno pertence a uma turma só: matricular quem já está em outra é uma
 * transferência, e o `transfer` é a confirmação vinda do diálogo. Tirar o
 * aluno da turma de outro professor continua sendo coordenação — o professor
 * só confirma a transferência quando a turma de origem também é dele.
 */
export async function enrollStudentInMyGroupAction(
  groupId: string,
  studentId: string,
  options: { transfer?: boolean } = {},
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["teacher"]);
  if (!isAdmin(ctx) && !(await isGroupOwnedByTeacher(groupId, ctx.userId)))
    return fail("FORBIDDEN", "Esta turma não é sua.");

  const parsed = createEnrollmentSchema.safeParse({ studentId });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Selecione um aluno.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const current = await getActiveEnrollmentForStudent(parsed.data.studentId);
  if (current && current.groupId !== groupId && !isAdmin(ctx)) {
    if (!(await isGroupOwnedByTeacher(current.groupId, ctx.userId)))
      return fail(
        "FORBIDDEN",
        `Este aluno está na turma ${current.groupName}, que não é sua. Peça à coordenação para movê-lo.`,
      );
  }

  const result = await enrollStudent(groupId, parsed.data.studentId, ctx.organizationId, {
    allowTransfer: options.transfer === true,
  });
  if (!result.success) return fail("CONFLICT", result.message ?? "Falha ao matricular.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: result.transferred ? "ENROLLMENT_TRANSFER" : "ENROLLMENT_CREATE",
    entityType: "group",
    entityId: groupId,
    metadata: { studentId: parsed.data.studentId },
  });

  revalidatePath("/turmas");
  return ok(undefined as never);
}

export async function transferStudentAction(
  fromGroupId: string,
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["teacher"]);

  const parsed = transferEnrollmentSchema.safeParse({
    enrollmentId: formData.get("enrollmentId"),
    toGroupId: formData.get("toGroupId"),
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Selecione a turma de destino.",
      parsed.error.flatten().fieldErrors,
    );
  }

  // Professor só move entre as próprias turmas; admin move entre quaisquer
  // (mover para a turma de outro professor é coordenação, papel do admin).
  if (!isAdmin(ctx)) {
    const [ownsSource, ownsTarget] = await Promise.all([
      isGroupOwnedByTeacher(fromGroupId, ctx.userId),
      isGroupOwnedByTeacher(parsed.data.toGroupId, ctx.userId),
    ]);
    if (!ownsSource || !ownsTarget)
      return fail("FORBIDDEN", "Você só pode mover alunos entre as suas turmas.");
  }

  const result = await transferStudent(parsed.data.enrollmentId, parsed.data.toGroupId);
  if (!result.success) return fail("CONFLICT", result.message ?? "Falha ao transferir.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "ENROLLMENT_TRANSFER",
    entityType: "group",
    entityId: parsed.data.toGroupId,
    metadata: {
      enrollmentId: parsed.data.enrollmentId,
      fromGroupId,
      studentId: result.studentId ?? null,
    },
  });

  revalidatePath("/turmas");
  return ok(undefined as never);
}

export async function unenrollFromMyGroupAction(
  groupId: string,
  enrollmentId: string,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["teacher"]);
  if (!isAdmin(ctx) && !(await isGroupOwnedByTeacher(groupId, ctx.userId)))
    return fail("FORBIDDEN", "Esta turma não é sua.");

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

  revalidatePath("/turmas");
  return ok(undefined as never);
}
