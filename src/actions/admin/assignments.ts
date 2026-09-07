"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth/session";
import { canTouchGroup, canTouchGroups, requireStaff } from "@/lib/auth/staff";
import { revalidateStaffPath } from "@/lib/areas.server";
import { auditLog } from "@/lib/audit";
import {
  notifyAssignmentCreated,
  notifyAssignmentDeleted,
  notifyAssignmentGraded,
} from "@/lib/notifications/events";
import * as repo from "@/repositories/assignments";
import {
  assignTemplateSchema,
  assignmentTemplateSchema,
  createExerciseAssignmentSchema,
  gradeSubmissionSchema,
} from "@/schemas/assignments";
import { fail, ok, type ActionResult } from "@/types/action-result";

/**
 * Tarefas do planejador (admin): mesma tabela `assignments` do professor,
 * mas o admin escolhe uma ou várias turmas de uma vez — cada turma vira uma
 * linha própria, então a nota e as entregas seguem independentes por turma.
 */

const PLANNER_SUFFIX = "/planejador";

export async function createPlannerAssignmentAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireStaff();

  const parsed = createExerciseAssignmentSchema.safeParse({
    groupIds: formData.getAll("groupIds"),
    title: formData.get("title"),
    instructions: formData.get("instructions") || undefined,
    questions: formData.get("questions") || undefined,
    dueAt: formData.get("dueAt") || undefined,
    maxScore: formData.get("maxScore") || undefined,
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }

  if (!(await canTouchGroups(ctx, parsed.data.groupIds)))
    return fail("FORBIDDEN", "Só dá para criar tarefa nas suas turmas.");

  const created = await repo.createAssignmentsForGroups({
    groupIds: parsed.data.groupIds,
    title: parsed.data.title,
    instructions: parsed.data.instructions,
    questions: parsed.data.questions,
    dueAt: parsed.data.dueAt,
    maxScore: parsed.data.maxScore,
    organizationId: ctx.organizationId,
    createdBy: ctx.userId,
  });
  if (!created) return fail("INTERNAL_ERROR", "Falha ao criar a tarefa.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "ASSIGNMENT_CREATE",
    entityType: "assignment",
    metadata: { groupIds: parsed.data.groupIds, title: parsed.data.title },
  });

  notifyAssignmentCreated({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    title: parsed.data.title,
    dueAt: parsed.data.dueAt,
    targets: created.map((row) => ({ groupId: row.groupId, assignmentId: row.id })),
  });

  revalidateStaffPath(PLANNER_SUFFIX);
  revalidatePath("/tarefas");
  return ok(undefined as never);
}

export async function deletePlannerAssignmentAction(
  assignmentId: string,
): Promise<ActionResult<never>> {
  const ctx = await requireStaff();

  // A tarefa precisa ser de uma turma de quem apaga — `deletePlannerAssignment`
  // só confere a escola.
  const assignment = await repo.getOrgAssignmentById(assignmentId, ctx.organizationId);
  if (!assignment) return fail("NOT_FOUND", "Tarefa não encontrada.");
  if (!(await canTouchGroup(ctx, assignment.groupId)))
    return fail("FORBIDDEN", "Esta turma não é sua.");

  const success = await repo.deletePlannerAssignment(assignmentId, ctx.organizationId);
  if (!success) return fail("INTERNAL_ERROR", "Falha ao excluir a tarefa.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "ASSIGNMENT_DELETE",
    entityType: "assignment",
    entityId: assignmentId,
  });

  notifyAssignmentDeleted({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    groupId: assignment.groupId,
    title: assignment.title,
  });

  revalidateStaffPath(PLANNER_SUFFIX);
  revalidatePath("/tarefas");
  return ok(undefined as never);
}

/**
 * Correção pelo admin. O professor tem a sua própria ação (que se autoriza
 * pelo RLS de dono da turma); aqui o recorte é a escola: a tarefa precisa ser
 * da mesma organização de quem está corrigindo, e é isso que
 * `getOrgAssignmentById` confirma antes de qualquer escrita.
 */
export async function gradeSubmissionAsAdminAction(
  assignmentId: string,
  studentId: string,
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireStaff();

  const parsed = gradeSubmissionSchema.safeParse({
    score: formData.get("score"),
    feedback: formData.get("feedback") || undefined,
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique a nota.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const assignment = await repo.getOrgAssignmentById(assignmentId, ctx.organizationId);
  if (!assignment) return fail("NOT_FOUND", "Tarefa não encontrada.");
  if (!(await canTouchGroup(ctx, assignment.groupId)))
    return fail("FORBIDDEN", "Esta turma não é sua.");

  if (assignment.maxScore != null && parsed.data.score > assignment.maxScore) {
    return fail(
      "VALIDATION_ERROR",
      `A nota máxima desta tarefa é ${assignment.maxScore}.`,
      {
        score: [`Use um valor entre 0 e ${assignment.maxScore}.`],
      },
    );
  }

  const success = await repo.gradeSubmission(
    assignmentId,
    studentId,
    ctx.userId,
    parsed.data.score,
    parsed.data.feedback,
  );
  if (!success) return fail("INTERNAL_ERROR", "Falha ao salvar a nota.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "SUBMISSION_GRADE",
    entityType: "assignment",
    entityId: assignmentId,
    metadata: { studentId },
  });

  notifyAssignmentGraded({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    assignmentId,
    studentId,
    title: assignment.title,
    score: parsed.data.score,
    maxScore: assignment.maxScore,
  });

  revalidateStaffPath(PLANNER_SUFFIX);
  revalidateStaffPath(`${PLANNER_SUFFIX}/tarefa/${assignmentId}`);
  revalidatePath(`/tarefas/${assignmentId}`);
  return ok(undefined as never);
}

// ------------------------------------------------------- tarefas padrão ----

/**
 * Ateliê de tarefas: monta o exercício sem escolher turma — vira `assignments`
 * de verdade só quando atribuída (`assignTemplateToGroupsAction`).
 */
export async function createAssignmentTemplateAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireStaff();

  const parsed = assignmentTemplateSchema.safeParse({
    title: formData.get("title"),
    instructions: formData.get("instructions") || undefined,
    questions: formData.get("questions") || undefined,
    maxScore: formData.get("maxScore") || undefined,
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const id = await repo.createAssignmentTemplate({
    title: parsed.data.title,
    instructions: parsed.data.instructions,
    questions: parsed.data.questions,
    maxScore: parsed.data.maxScore,
    organizationId: ctx.organizationId,
    ownerId: ctx.userId,
  });
  if (!id) return fail("INTERNAL_ERROR", "Falha ao criar a tarefa padrão.");

  revalidateStaffPath(PLANNER_SUFFIX);
  return ok(undefined as never);
}

export async function deleteAssignmentTemplateAction(
  templateId: string,
): Promise<ActionResult<never>> {
  const ctx = await requireStaff();

  const template = await repo.getAssignmentTemplateForAssign(
    templateId,
    ctx.organizationId,
  );
  if (!template) return fail("NOT_FOUND", "Tarefa padrão não encontrada.");
  if (!isAdmin(ctx) && template.ownerId !== ctx.userId)
    return fail("FORBIDDEN", "Esta tarefa padrão não é sua.");

  const success = await repo.deleteAssignmentTemplate(templateId, ctx.organizationId);
  if (!success) return fail("INTERNAL_ERROR", "Falha ao excluir a tarefa padrão.");

  revalidateStaffPath(PLANNER_SUFFIX);
  return ok(undefined as never);
}

/** Manda uma tarefa padrão para uma ou mais turmas — uma linha em `assignments` por turma. */
export async function assignTemplateToGroupsAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireStaff();

  const parsed = assignTemplateSchema.safeParse({
    templateId: formData.get("templateId"),
    groupIds: formData.getAll("groupIds"),
    dueAt: formData.get("dueAt") || undefined,
    maxScore: formData.get("maxScore") || undefined,
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const template = await repo.getAssignmentTemplateForAssign(
    parsed.data.templateId,
    ctx.organizationId,
  );
  if (!template) return fail("NOT_FOUND", "Tarefa padrão não encontrada.");
  if (!isAdmin(ctx) && template.ownerId !== ctx.userId)
    return fail("FORBIDDEN", "Esta tarefa padrão não é sua.");

  if (!(await canTouchGroups(ctx, parsed.data.groupIds)))
    return fail("FORBIDDEN", "Só dá para atribuir tarefa nas suas turmas.");

  const created = await repo.createAssignmentsFromTemplate({
    templateId: parsed.data.templateId,
    groupIds: parsed.data.groupIds,
    title: template.title,
    instructions: template.instructions,
    answerKey: template.answerKey,
    dueAt: parsed.data.dueAt,
    maxScore: parsed.data.maxScore ?? template.maxScore,
    organizationId: ctx.organizationId,
    createdBy: ctx.userId,
  });
  if (!created) return fail("INTERNAL_ERROR", "Falha ao atribuir a tarefa.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "ASSIGNMENT_CREATE",
    entityType: "assignment",
    metadata: {
      groupIds: parsed.data.groupIds,
      title: template.title,
      templateId: parsed.data.templateId,
    },
  });

  notifyAssignmentCreated({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    title: template.title,
    dueAt: parsed.data.dueAt,
    targets: created.map((row) => ({ groupId: row.groupId, assignmentId: row.id })),
  });

  revalidateStaffPath(PLANNER_SUFFIX);
  revalidatePath("/tarefas");
  return ok(undefined as never);
}
