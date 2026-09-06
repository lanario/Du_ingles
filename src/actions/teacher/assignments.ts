"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit";
import {
  notifyAssignmentCreated,
  notifyAssignmentGraded,
} from "@/lib/notifications/events";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import * as repo from "@/repositories/assignments";
import { createAssignmentSchema, gradeSubmissionSchema } from "@/schemas/assignments";
import { fail, ok, type ActionResult } from "@/types/action-result";

export async function createAssignmentAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["teacher"]);

  const parsed = createAssignmentSchema.safeParse({
    groupId: formData.get("groupId"),
    title: formData.get("title"),
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

  // `assignments_write_teacher` (RLS) exige teaches_group(groupId) — se o
  // professor não for dono da turma, o insert falha aqui mesmo.
  const assignmentId = await repo.createAssignment({
    groupId: parsed.data.groupId,
    title: parsed.data.title,
    dueAt: parsed.data.dueAt,
    maxScore: parsed.data.maxScore,
    organizationId: ctx.organizationId,
    createdBy: ctx.userId,
  });
  if (!assignmentId)
    return fail("FORBIDDEN", "Não foi possível criar a tarefa para essa turma.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "ASSIGNMENT_CREATE",
    entityType: "group",
    entityId: parsed.data.groupId,
  });

  notifyAssignmentCreated({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    title: parsed.data.title,
    dueAt: parsed.data.dueAt,
    targets: [{ groupId: parsed.data.groupId, assignmentId }],
  });

  revalidatePath("/tarefas");
  return ok(undefined as never);
}

export async function gradeSubmissionAction(
  assignmentId: string,
  studentId: string,
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["teacher"]);

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

  // repo.gradeSubmission usa service-role (colunas de nota têm UPDATE
  // revogado de `authenticated`) — essa leitura via client normal, que
  // respeita `assignments_select_teacher`, É a autorização real aqui.
  const supabase = await createServerSupabaseClient();
  const { data: owned } = await supabase
    .from("assignments")
    .select("id, title, max_score")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!owned) return fail("NOT_FOUND", "Tarefa não encontrada.");

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
    title: owned.title,
    score: parsed.data.score,
    maxScore: owned.max_score,
  });

  revalidatePath(`/tarefas/${assignmentId}`);
  return ok(undefined as never);
}
