"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { fromZonedTime } from "date-fns-tz";
import { requireRole } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit";
import { generateSessionPdf } from "@/lib/pdf/generate";
import * as planner from "@/repositories/lesson-planner";
import * as live from "@/repositories/live-session";
import { recordAttendanceSchema } from "@/schemas/attendance";
import {
  plannerPlanSchema,
  rescheduleSessionSchema,
  schedulePlannerSessionSchema,
} from "@/schemas/lesson-planner";
import { fail, ok, type ActionResult } from "@/types/action-result";
import type { Json } from "@/types/database.types";

/** Fuso da escola — data e hora digitadas no formulário são locais, não UTC. */
const TZ = "America/Sao_Paulo";

const PLANNER_PATH = "/admin/planejador";

/**
 * Toda action aqui exige admin e confirma que a entidade pertence à
 * organização de quem chama. As queries do repositório usam service-role
 * (ignoram RLS), então esse par papel + org É a autorização real.
 */

function toUtcIso(date: string, time: string): string {
  return fromZonedTime(`${date}T${time}:00`, TZ).toISOString();
}

// --------------------------------------------------------------- planos ----

export async function createPlannerPlanAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);

  const parsed = plannerPlanSchema.safeParse({
    title: formData.get("title"),
    summary: formData.get("summary"),
    level: formData.get("level"),
    durationMinutes: formData.get("durationMinutes") || undefined,
    isShared: formData.get("isShared") === "on",
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const id = await planner.createPlannerPlan(
    parsed.data,
    ctx.organizationId,
    ctx.userId,
  );
  if (!id) return fail("INTERNAL_ERROR", "Falha ao criar o plano.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "LESSON_PLAN_CREATE",
    entityType: "lesson_plan",
    entityId: id,
  });

  revalidatePath(PLANNER_PATH);
  redirect(`${PLANNER_PATH}/${id}`);
}

export async function updatePlannerPlanMetaAction(
  planId: string,
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);

  const parsed = plannerPlanSchema.safeParse({
    title: formData.get("title"),
    summary: formData.get("summary"),
    level: formData.get("level"),
    durationMinutes: formData.get("durationMinutes"),
    isShared: formData.get("isShared") === "on",
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const success = await planner.updatePlannerPlanMeta(
    planId,
    ctx.organizationId,
    parsed.data,
  );
  if (!success) return fail("INTERNAL_ERROR", "Falha ao salvar.");

  revalidatePath(PLANNER_PATH);
  revalidatePath(`${PLANNER_PATH}/${planId}`);
  return ok(undefined as never);
}

/** Autosave do canvas: recebe o documento já serializado pelo Tiptap. */
export async function savePlannerPlanContentAction(
  planId: string,
  content: Json,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);

  const success = await planner.updatePlannerPlanContent(
    planId,
    ctx.organizationId,
    content,
  );
  if (!success) return fail("INTERNAL_ERROR", "Falha ao salvar.");
  return ok(undefined as never);
}

export async function duplicatePlannerPlanAction(
  planId: string,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);

  const id = await planner.duplicatePlannerPlan(
    planId,
    ctx.organizationId,
    ctx.userId,
  );
  if (!id) return fail("INTERNAL_ERROR", "Falha ao duplicar.");

  revalidatePath(PLANNER_PATH);
  redirect(`${PLANNER_PATH}/${id}`);
}

export async function deletePlannerPlanAction(
  planId: string,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);

  const success = await planner.deletePlannerPlan(planId, ctx.organizationId);
  if (!success) return fail("INTERNAL_ERROR", "Falha ao excluir.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "LESSON_PLAN_DELETE",
    entityType: "lesson_plan",
    entityId: planId,
  });

  revalidatePath(PLANNER_PATH);
  return ok(undefined as never);
}

// -------------------------------------------------------------- agenda -----

export async function scheduleSessionAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);

  const parsed = schedulePlannerSessionSchema.safeParse({
    groupId: formData.get("groupId"),
    lessonPlanId: formData.get("lessonPlanId"),
    teacherId: formData.get("teacherId"),
    title: formData.get("title"),
    date: formData.get("date"),
    time: formData.get("time"),
    durationMinutes: formData.get("durationMinutes") || undefined,
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const groups = await planner.listPlannerGroups(ctx.organizationId);
  const group = groups.find((item) => item.id === parsed.data.groupId);
  if (!group) return fail("NOT_FOUND", "Turma não encontrada.");

  // Sem professor escolhido, a aula fica com o titular da turma — é quem
  // aparece para o aluno e quem responde pela sessão nos relatórios.
  const teacherId = parsed.data.teacherId ?? group.teacherId;
  if (!teacherId) return fail("VALIDATION_ERROR", "A turma não tem professor.");

  const id = await planner.schedulePlannerSession({
    organizationId: ctx.organizationId,
    groupId: parsed.data.groupId,
    teacherId,
    lessonPlanId: parsed.data.lessonPlanId ?? null,
    title: parsed.data.title,
    scheduledAt: toUtcIso(parsed.data.date, parsed.data.time),
    durationMinutes: parsed.data.durationMinutes,
  });
  if (!id) return fail("INTERNAL_ERROR", "Falha ao agendar a aula.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "SESSION_SCHEDULE",
    entityType: "class_session",
    entityId: id,
    metadata: { groupId: parsed.data.groupId },
  });

  revalidatePath(PLANNER_PATH);
  return ok(undefined as never);
}

export async function rescheduleSessionAction(
  sessionId: string,
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);

  const parsed = rescheduleSessionSchema.safeParse({
    date: formData.get("date"),
    time: formData.get("time"),
    durationMinutes: formData.get("durationMinutes"),
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const success = await planner.reschedulePlannerSession(
    sessionId,
    ctx.organizationId,
    toUtcIso(parsed.data.date, parsed.data.time),
    parsed.data.durationMinutes,
  );
  if (!success) return fail("CONFLICT", "Só é possível remarcar aula agendada.");

  revalidatePath(PLANNER_PATH);
  return ok(undefined as never);
}

export async function cancelSessionAction(
  sessionId: string,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);

  const success = await planner.cancelPlannerSession(sessionId, ctx.organizationId);
  if (!success) return fail("CONFLICT", "Só é possível cancelar aula agendada.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "SESSION_CANCEL",
    entityType: "class_session",
    entityId: sessionId,
  });

  revalidatePath(PLANNER_PATH);
  return ok(undefined as never);
}

// ---------------------------------------------------------- sala de aula ---

async function loadOrgSession(sessionId: string, organizationId: string) {
  return planner.getPlannerSession(sessionId, organizationId);
}

export async function startPlannerSessionAction(
  sessionId: string,
  lessonPlanId: string | null,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);

  const session = await loadOrgSession(sessionId, ctx.organizationId);
  if (!session) return fail("NOT_FOUND", "Aula não encontrada.");
  if (session.status !== "scheduled")
    return fail("CONFLICT", "Esta aula já foi iniciada.");

  // O conteúdo do plano é COPIADO para a sessão (§4.1): editar a aula ao vivo
  // nunca reescreve o plano de origem, que segue servindo às próximas turmas.
  const success = await live.startSession(sessionId, lessonPlanId);
  if (!success) return fail("INTERNAL_ERROR", "Falha ao iniciar a aula.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "SESSION_START",
    entityType: "class_session",
    entityId: sessionId,
  });

  revalidatePath(`${PLANNER_PATH}/aula/${sessionId}`);
  return ok(undefined as never);
}

export async function savePlannerSessionContentAction(
  sessionId: string,
  content: Json,
  teacherNotes?: string,
  homework?: string,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);

  const session = await loadOrgSession(sessionId, ctx.organizationId);
  if (!session) return fail("NOT_FOUND", "Aula não encontrada.");
  if (session.status === "completed")
    return fail("CONFLICT", "Esta aula já foi encerrada.");

  const success = await live.saveContent(sessionId, content, teacherNotes, homework);
  if (!success) return fail("INTERNAL_ERROR", "Falha ao salvar.");
  return ok(undefined as never);
}

export async function savePlannerSessionVersionAction(
  sessionId: string,
  content: Json,
): Promise<void> {
  const ctx = await requireRole(["admin"]);
  const session = await loadOrgSession(sessionId, ctx.organizationId);
  if (!session) return;
  await live.saveVersion(sessionId, content, ctx.userId);
}

export async function acquirePlannerLockAction(
  sessionId: string,
  clientId: string,
): Promise<{ acquired: boolean; heldBySomeoneElse: boolean }> {
  const ctx = await requireRole(["admin"]);
  const session = await loadOrgSession(sessionId, ctx.organizationId);
  if (!session) return { acquired: false, heldBySomeoneElse: false };
  return live.acquireLock(sessionId, clientId);
}

export async function endPlannerSessionAction(
  sessionId: string,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);

  const session = await loadOrgSession(sessionId, ctx.organizationId);
  if (!session) return fail("NOT_FOUND", "Aula não encontrada.");
  if (session.status !== "in_progress")
    return fail("CONFLICT", "Esta aula não está em andamento.");

  const success = await live.endSession(sessionId);
  if (!success) return fail("INTERNAL_ERROR", "Falha ao encerrar a aula.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "SESSION_END",
    entityType: "class_session",
    entityId: sessionId,
  });

  // Depois da resposta: o PDF não pode segurar a tela de quem acabou de dar aula.
  after(() => generateSessionPdf(sessionId));

  revalidatePath(`${PLANNER_PATH}/aula/${sessionId}`);
  revalidatePath(PLANNER_PATH);
  return ok(undefined as never);
}

export async function recordPlannerAttendanceAction(
  sessionId: string,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);

  const session = await loadOrgSession(sessionId, ctx.organizationId);
  if (!session) return fail("NOT_FOUND", "Aula não encontrada.");

  let entries: unknown;
  try {
    entries = JSON.parse(String(formData.get("entries")));
  } catch {
    return fail("VALIDATION_ERROR", "Dados de chamada inválidos.");
  }

  const parsed = recordAttendanceSchema.safeParse({ entries });
  if (!parsed.success) return fail("VALIDATION_ERROR", "Dados de chamada inválidos.");

  const success = await planner.recordPlannerAttendance(
    sessionId,
    ctx.organizationId,
    ctx.userId,
    parsed.data.entries,
  );
  if (!success) return fail("INTERNAL_ERROR", "Falha ao salvar a chamada.");

  revalidatePath(`${PLANNER_PATH}/aula/${sessionId}`);
  return ok(undefined as never);
}
