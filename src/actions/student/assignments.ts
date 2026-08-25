"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit";
import * as repo from "@/repositories/assignments";
import { answersToPlainText, type StudentAnswers } from "@/lib/assignments/exercises";
import { answersFieldSchema, submitAssignmentSchema } from "@/schemas/assignments";
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

  revalidatePath("/tarefas");
  revalidatePath(`/tarefas/${assignmentId}`);
  return ok(undefined as never);
}

/**
 * Envio do exercício digital (tarefa com questões).
 *
 * Duas coisas que o cliente manda e o servidor NÃO acredita: quais questões
 * existem e quanto cada uma vale. Ambas são relidas da tarefa aqui — o mapa
 * de respostas é filtrado contra os ids reais, então campo inventado no
 * FormData é descartado antes de chegar ao banco.
 */
export async function submitExerciseAction(
  assignmentId: string,
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["student"]);

  // Leitura via client normal: `assignments_select_student` é o que confirma
  // que este aluno está matriculado na turma da tarefa.
  const assignment = await repo.getAssignmentById(assignmentId);
  if (!assignment) return fail("NOT_FOUND", "Tarefa não encontrada.");
  if (assignment.questions.length === 0) {
    return fail("CONFLICT", "Esta tarefa não tem exercício para responder.");
  }

  const draft = formData.get("draft") === "1";

  let rawAnswers: unknown;
  try {
    rawAnswers = JSON.parse(String(formData.get("answers") ?? "{}"));
  } catch {
    return fail("VALIDATION_ERROR", "Não foi possível ler suas respostas.");
  }

  const parsedAnswers = answersFieldSchema.safeParse(rawAnswers);
  if (!parsedAnswers.success) {
    return fail("VALIDATION_ERROR", "Não foi possível ler suas respostas.");
  }

  const answers: StudentAnswers = {};
  for (const question of assignment.questions) {
    const value = parsedAnswers.data[question.id];
    if (typeof value === "string" && value.trim() !== "") {
      answers[question.id] = value.trim();
    }
  }

  if (!draft) {
    const missing = assignment.questions.filter((q) => !(q.id in answers));
    if (missing.length > 0) {
      const first = assignment.questions.findIndex((q) => q.id === missing[0]!.id) + 1;
      return fail(
        "VALIDATION_ERROR",
        missing.length === 1
          ? `Falta responder a questão ${first}.`
          : `Faltam ${missing.length} questões — a primeira é a ${first}.`,
      );
    }
  }

  const saved = await repo.saveAnswers({
    assignmentId,
    studentId: ctx.userId,
    organizationId: ctx.organizationId,
    answers,
    content: answersToPlainText(assignment.questions, answers),
    draft,
  });
  if (!saved) {
    return fail(
      "FORBIDDEN",
      "Não foi possível salvar. Se a tarefa já foi corrigida, ela não aceita mais alterações.",
    );
  }

  if (!draft) {
    // Corrige as objetivas e guarda a prévia para o professor. O aluno não vê
    // nada disso até a nota ser fechada — ver `storeAutoGrade`.
    await repo.storeAutoGrade(assignmentId, ctx.userId, answers);

    await auditLog({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      actorRole: ctx.realRole,
      action: "ASSIGNMENT_SUBMIT",
      entityType: "assignment",
      entityId: assignmentId,
    });
  }

  revalidatePath("/tarefas");
  revalidatePath(`/tarefas/${assignmentId}`);
  return ok(undefined as never);
}
