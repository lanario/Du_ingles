"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit";
import * as repo from "@/repositories/assignments";
import { createPlannerAssignmentSchema } from "@/schemas/assignments";
import { fail, ok, type ActionResult } from "@/types/action-result";

/**
 * Tarefas do planejador (admin): mesma tabela `assignments` do professor,
 * mas o admin escolhe uma ou várias turmas de uma vez — cada turma vira uma
 * linha própria, então a nota e as entregas seguem independentes por turma.
 */

const PLANNER_PATH = "/admin/planejador";

export async function createPlannerAssignmentAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);

  const parsed = createPlannerAssignmentSchema.safeParse({
    groupIds: formData.getAll("groupIds"),
    title: formData.get("title"),
    instructions: formData.get("instructions") || undefined,
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

  const success = await repo.createAssignmentsForGroups({
    groupIds: parsed.data.groupIds,
    title: parsed.data.title,
    instructions: parsed.data.instructions,
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

  revalidatePath(PLANNER_PATH);
  revalidatePath("/tarefas");
  return ok(undefined as never);
}

export async function deletePlannerAssignmentAction(
  assignmentId: string,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);

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

  revalidatePath(PLANNER_PATH);
  revalidatePath("/tarefas");
  return ok(undefined as never);
}
