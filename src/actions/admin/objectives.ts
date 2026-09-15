"use server";

import { canSeeStudent, canTouchGroup, requireStaff } from "@/lib/auth/staff";
import type { SessionContext } from "@/lib/auth/session";
import { revalidateStaffPath } from "@/lib/areas.server";
import { auditLog } from "@/lib/audit";
import {
  notifyObjectiveAssigned,
  notifyObjectiveCompleted,
} from "@/lib/notifications/events";
import * as audience from "@/lib/notifications/audience";
import type { Recipient } from "@/lib/notifications/dispatch";
import * as repo from "@/repositories/objectives";
import { objectiveFieldsSchema } from "@/schemas/objectives";
import { fail, ok, type ActionResult } from "@/types/action-result";

/**
 * Objetivos: admin e professor dividem a mesma ação (`requireStaff`), como já
 * acontece em `admin/assignments.ts` — a diferença entre os dois papéis é só
 * o alcance de `canTouchGroup`/`canSeeStudent`, não o código que roda.
 */

async function recipientsFor(objective: {
  groupId: string | null;
  studentId: string | null;
}): Promise<Recipient[]> {
  if (objective.groupId) return audience.groupStudents(objective.groupId);
  if (objective.studentId) return audience.resolveRecipients([objective.studentId]);
  return [];
}

async function checkOwnership(
  ctx: SessionContext,
  objective: { groupId: string | null; studentId: string | null },
): Promise<boolean> {
  if (objective.groupId) return canTouchGroup(ctx, objective.groupId);
  if (objective.studentId) return canSeeStudent(ctx, objective.studentId);
  return false;
}

export async function createGroupObjectiveAction(
  groupId: string,
  fields: { title: string; description?: string },
): Promise<ActionResult<never>> {
  const ctx = await requireStaff();

  const parsed = objectiveFieldsSchema.safeParse(fields);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }
  if (!(await canTouchGroup(ctx, groupId)))
    return fail("FORBIDDEN", "Esta turma não é sua.");

  const id = await repo.createGroupObjective({
    groupId,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    organizationId: ctx.organizationId,
    createdBy: ctx.userId,
  });
  if (!id) return fail("INTERNAL_ERROR", "Falha ao criar o objetivo.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "OBJECTIVE_CREATE",
    entityType: "group",
    entityId: groupId,
    metadata: { title: parsed.data.title },
  });

  notifyObjectiveAssigned({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    title: parsed.data.title,
    recipients: await audience.groupStudents(groupId),
  });

  revalidateStaffPath("/turmas");
  return ok(undefined as never);
}

export async function createStudentObjectiveAction(
  studentId: string,
  fields: { title: string; description?: string },
): Promise<ActionResult<never>> {
  const ctx = await requireStaff();

  const parsed = objectiveFieldsSchema.safeParse(fields);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }
  if (!(await canSeeStudent(ctx, studentId)))
    return fail("FORBIDDEN", "Este aluno não é seu.");

  const id = await repo.createStudentObjective({
    studentId,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    organizationId: ctx.organizationId,
    createdBy: ctx.userId,
  });
  if (!id) return fail("INTERNAL_ERROR", "Falha ao criar o objetivo.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "OBJECTIVE_CREATE",
    entityType: "profile",
    entityId: studentId,
    metadata: { title: parsed.data.title },
  });

  notifyObjectiveAssigned({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    title: parsed.data.title,
    recipients: await audience.resolveRecipients([studentId]),
  });

  revalidateStaffPath("/alunos");
  return ok(undefined as never);
}

export async function toggleObjectiveCompletedAction(
  objectiveId: string,
  completed: boolean,
): Promise<ActionResult<never>> {
  const ctx = await requireStaff();

  const objective = await repo.getObjectiveForOwnershipCheck(
    objectiveId,
    ctx.organizationId,
  );
  if (!objective) return fail("NOT_FOUND", "Objetivo não encontrado.");
  if (!(await checkOwnership(ctx, objective)))
    return fail("FORBIDDEN", "Este objetivo não é seu.");

  const success = await repo.setObjectiveCompleted(
    objectiveId,
    ctx.organizationId,
    completed,
    ctx.userId,
  );
  if (!success) return fail("INTERNAL_ERROR", "Falha ao atualizar o objetivo.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: completed ? "OBJECTIVE_COMPLETE" : "OBJECTIVE_REOPEN",
    entityType: "learning_objective",
    entityId: objectiveId,
  });

  if (completed) {
    notifyObjectiveCompleted({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      title: objective.title,
      recipients: await recipientsFor(objective),
    });
  }

  revalidateStaffPath("/turmas");
  revalidateStaffPath("/alunos");
  return ok(undefined as never);
}

export async function deleteObjectiveAction(
  objectiveId: string,
): Promise<ActionResult<never>> {
  const ctx = await requireStaff();

  const objective = await repo.getObjectiveForOwnershipCheck(
    objectiveId,
    ctx.organizationId,
  );
  if (!objective) return fail("NOT_FOUND", "Objetivo não encontrado.");
  if (!(await checkOwnership(ctx, objective)))
    return fail("FORBIDDEN", "Este objetivo não é seu.");

  const success = await repo.deleteObjective(objectiveId, ctx.organizationId);
  if (!success) return fail("INTERNAL_ERROR", "Falha ao excluir o objetivo.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "OBJECTIVE_DELETE",
    entityType: "learning_objective",
    entityId: objectiveId,
  });

  revalidateStaffPath("/turmas");
  revalidateStaffPath("/alunos");
  return ok(undefined as never);
}

/** Objetivos de um aluno (diretos + da turma dele) para a ficha em `/alunos`. */
export async function listStudentObjectivesAction(
  studentId: string,
): Promise<repo.ObjectiveItem[]> {
  const ctx = await requireStaff();
  if (!(await canSeeStudent(ctx, studentId))) return [];
  return repo.listVisibleObjectivesForStudent(studentId);
}
