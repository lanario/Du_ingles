"use server";

import { redirect } from "next/navigation";
import type { Route } from "next";
import { after } from "next/server";
import { fromZonedTime } from "date-fns-tz";
import { isAdmin } from "@/lib/auth/session";
import { canTouchGroup, requireStaff, staffBase } from "@/lib/auth/staff";
import { revalidateStaffPath } from "@/lib/areas.server";
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

const PLANNER_SUFFIX = "/planejador";

/**
 * Toda action aqui exige coordenação ou professor e confirma que a entidade
 * pertence à organização de quem chama. As queries do repositório usam
 * service-role (ignoram RLS), então esse par papel + org É a autorização real.
 *
 * Para o professor há uma segunda trava, porque "mesma escola" não é o
 * recorte dele: plano tem que ser de sua autoria, aula tem que ser sua e
 * turma tem que ser sua (`canTouchGroup`). O admin passa em todas.
 */

function toUtcIso(date: string, time: string): string {
  return fromZonedTime(`${date}T${time}:00`, TZ).toISOString();
}

/** Plano que quem chama pode reescrever: da escola e (se professor) dele. */
async function loadWritablePlan(
  ctx: Awaited<ReturnType<typeof requireStaff>>,
  planId: string,
) {
  const plan = await planner.getPlannerPlan(planId, ctx.organizationId);
  if (!plan) return null;
  if (!isAdmin(ctx) && plan.authorId !== ctx.userId) return null;
  return plan;
}

/**
 * Aula que quem chama pode conduzir. O admin dá aula de qualquer turma (é
 * quem cobre falta); o professor, só as suas.
 */
async function loadOwnedSession(
  ctx: Awaited<ReturnType<typeof requireStaff>>,
  sessionId: string,
) {
  const session = await planner.getPlannerSession(sessionId, ctx.organizationId);
  if (!session) return null;
  if (!isAdmin(ctx) && session.teacherId !== ctx.userId) return null;
  return session;
}

// --------------------------------------------------------------- planos ----

export async function createPlannerPlanAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireStaff();

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

  revalidateStaffPath(PLANNER_SUFFIX);
  redirect(`${staffBase(ctx)}${PLANNER_SUFFIX}/${id}` as Route);
}

export async function updatePlannerPlanMetaAction(
  planId: string,
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireStaff();
  if (!(await loadWritablePlan(ctx, planId)))
    return fail("FORBIDDEN", "Este plano não é seu.");

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

  revalidateStaffPath(PLANNER_SUFFIX);
  revalidateStaffPath(`${PLANNER_SUFFIX}/${planId}`);
  return ok(undefined as never);
}

/** Autosave do canvas: recebe o documento já serializado pelo Tiptap. */
export async function savePlannerPlanContentAction(
  planId: string,
  content: Json,
): Promise<ActionResult<never>> {
  const ctx = await requireStaff();
  if (!(await loadWritablePlan(ctx, planId)))
    return fail("FORBIDDEN", "Este plano não é seu.");

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
  const ctx = await requireStaff();

  // Duplicar não escreve no original — basta poder lê-lo: o próprio, ou um
  // compartilhado pela escola. A cópia nasce no nome de quem duplicou.
  const source = await planner.getPlannerPlan(planId, ctx.organizationId);
  if (!source || (!isAdmin(ctx) && source.authorId !== ctx.userId && !source.isShared))
    return fail("NOT_FOUND", "Plano não encontrado.");

  const id = await planner.duplicatePlannerPlan(
    planId,
    ctx.organizationId,
    ctx.userId,
  );
  if (!id) return fail("INTERNAL_ERROR", "Falha ao duplicar.");

  revalidateStaffPath(PLANNER_SUFFIX);
  redirect(`${staffBase(ctx)}${PLANNER_SUFFIX}/${id}` as Route);
}

export async function deletePlannerPlanAction(
  planId: string,
): Promise<ActionResult<never>> {
  const ctx = await requireStaff();
  if (!(await loadWritablePlan(ctx, planId)))
    return fail("FORBIDDEN", "Este plano não é seu.");

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

  revalidateStaffPath(PLANNER_SUFFIX);
  return ok(undefined as never);
}

// -------------------------------------------------------------- agenda -----

export async function scheduleSessionAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireStaff();

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
  if (!(await canTouchGroup(ctx, parsed.data.groupId)))
    return fail("FORBIDDEN", "Esta turma não é sua.");

  // Sem professor escolhido, a aula fica com o titular da turma — é quem
  // aparece para o aluno e quem responde pela sessão nos relatórios. O
  // professor agenda sempre para si: escalar outra pessoa é coordenação.
  const teacherId = isAdmin(ctx)
    ? (parsed.data.teacherId ?? group.teacherId)
    : ctx.userId;
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

  revalidateStaffPath(PLANNER_SUFFIX);
  return ok(undefined as never);
}

export async function rescheduleSessionAction(
  sessionId: string,
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireStaff();
  if (!(await loadOwnedSession(ctx, sessionId)))
    return fail("NOT_FOUND", "Aula não encontrada.");

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

  revalidateStaffPath(PLANNER_SUFFIX);
  return ok(undefined as never);
}

export async function cancelSessionAction(
  sessionId: string,
): Promise<ActionResult<never>> {
  const ctx = await requireStaff();
  if (!(await loadOwnedSession(ctx, sessionId)))
    return fail("NOT_FOUND", "Aula não encontrada.");

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

  revalidateStaffPath(PLANNER_SUFFIX);
  return ok(undefined as never);
}

// ---------------------------------------------------------- sala de aula ---

export async function startPlannerSessionAction(
  sessionId: string,
  lessonPlanId: string | null,
): Promise<ActionResult<never>> {
  const ctx = await requireStaff();

  const session = await loadOwnedSession(ctx, sessionId);
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

  revalidateStaffPath(`${PLANNER_SUFFIX}/aula/${sessionId}`);
  return ok(undefined as never);
}

export async function savePlannerSessionContentAction(
  sessionId: string,
  content: Json,
  teacherNotes?: string,
  homework?: string,
): Promise<ActionResult<never>> {
  const ctx = await requireStaff();

  const session = await loadOwnedSession(ctx, sessionId);
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
  const ctx = await requireStaff();
  const session = await loadOwnedSession(ctx, sessionId);
  if (!session) return;
  await live.saveVersion(sessionId, content, ctx.userId);
}

export async function acquirePlannerLockAction(
  sessionId: string,
  clientId: string,
): Promise<{ acquired: boolean; heldBySomeoneElse: boolean }> {
  const ctx = await requireStaff();
  const session = await loadOwnedSession(ctx, sessionId);
  if (!session) return { acquired: false, heldBySomeoneElse: false };
  return live.acquireLock(sessionId, clientId);
}

export async function endPlannerSessionAction(
  sessionId: string,
): Promise<ActionResult<never>> {
  const ctx = await requireStaff();

  const session = await loadOwnedSession(ctx, sessionId);
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

  revalidateStaffPath(`${PLANNER_SUFFIX}/aula/${sessionId}`);
  revalidateStaffPath(PLANNER_SUFFIX);
  return ok(undefined as never);
}

export async function recordPlannerAttendanceAction(
  sessionId: string,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireStaff();

  const session = await loadOwnedSession(ctx, sessionId);
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

  revalidateStaffPath(`${PLANNER_SUFFIX}/aula/${sessionId}`);
  return ok(undefined as never);
}
