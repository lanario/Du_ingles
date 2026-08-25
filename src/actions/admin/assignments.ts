"use server";

import { revalidatePath } from "next/cache";
import { canTouchGroup, canTouchGroups, requireStaff } from "@/lib/auth/staff";
import { revalidateStaffPath } from "@/lib/areas.server";
import { auditLog } from "@/lib/audit";
import * as repo from "@/repositories/assignments";
import {
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

  const success = await repo.createAssignmentsForGroups({
    groupIds: parsed.data.groupIds,
    title: parsed.data.title,
    instructions: parsed.data.instructions,
    questions: parsed.data.questions,
    dueAt: parsed.data.dueAt,
    maxScore: parsed.data.maxScore,
    organizationId: ctx.organizationId,
    createdBy: ctx.userId,
  });
  if (!success) return fail("INTERNAL_ERROR", "Falha ao criar a tarefa.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "ASSIGNMENT_CREATE",
    entityType: "assignment",
    metadata: { groupIds: parsed.data.groupIds, title: parsed.data.title },
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
    return fail("VALIDATION_ERROR", `A nota máxima desta tarefa é ${assignment.maxScore}.`, {
      score: [`Use um valor entre 0 e ${assignment.maxScore}.`],
    });
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

  revalidateStaffPath(PLANNER_SUFFIX);
  revalidateStaffPath(`${PLANNER_SUFFIX}/tarefa/${assignmentId}`);
  revalidatePath(`/tarefas/${assignmentId}`);
  return ok(undefined as never);
}
