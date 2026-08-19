"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit";
import * as repo from "@/repositories/assignments";
import { submitAssignmentSchema } from "@/schemas/assignments";
import { fail, ok, type ActionResult } from "@/types/action-result";

export async function submitAssignmentAction(
  assignmentId: string,
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["student"]);

  const parsed = submitAssignmentSchema.safeParse({
    content: formData.get("content"),
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Escreva sua resposta.",
      parsed.error.flatten().fieldErrors,
    );
  }

  // `submissions_insert_own` / `submissions_update_own_pending` (RLS) só
  // permitem ao próprio aluno gravar sua submissão enquanto pendente.
  const success = await repo.submitAssignment(
    assignmentId,
    ctx.userId,
    ctx.organizationId,
    parsed.data.content,
  );
  if (!success) return fail("FORBIDDEN", "Não foi possível enviar a resposta.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "ASSIGNMENT_SUBMIT",
    entityType: "assignment",
    entityId: assignmentId,
  });

  revalidatePath(`/tarefas/${assignmentId}`);
  return ok(undefined as never);
}
