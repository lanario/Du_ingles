"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { after } from "next/server";
import { fromZonedTime } from "date-fns-tz";
import { isAdmin } from "@/lib/auth/session";
import { canTouchGroup, requireStaff, staffBase } from "@/lib/auth/staff";
import { revalidateStaffPath } from "@/lib/areas.server";
import { auditLog } from "@/lib/audit";
import {
  notifyAttendanceRecorded,
  notifySessionCancelled,
  notifySessionEnded,
  notifySessionRescheduled,
  notifySessionScheduled,
  notifySessionStarted,
} from "@/lib/notifications/events";
import { generateSessionPdf } from "@/lib/pdf/generate";
import * as planner from "@/repositories/lesson-planner";
import * as live from "@/repositories/live-session";
import { recordAttendanceSchema } from "@/schemas/attendance";
import {
  movePlannerPlanSchema,
  nextSessionSchema,
  plannerFolderSchema,
  plannerPlanSchema,
  sessionRecordingSchema,
  rescheduleSessionSchema,
  schedulePlannerSessionSchema,
} from "@/schemas/lesson-planner";
import { fail, ok, type ActionResult } from "@/types/action-result";
import type { Json } from "@/types/database.types";

/** Fuso da escola — data e hora digitadas no formulário são locais, não UTC. */
const TZ = "America/Sao_Paulo";

const PLANNER_SUFFIX = "/planejador";

/**
 * Mexer numa aula muda três telas: a agenda do planejador, a ficha da turma
 * (onde a linha do tempo de sessões mora) e o painel de quem vai à aula.
 * Revalidar só o planejador deixava a ficha da turma servindo cache velho.
 */
function revalidateSession(groupId: string): void {
  revalidateStaffPath(PLANNER_SUFFIX);
  revalidateStaffPath("/turmas");
  revalidateStaffPath(`/turmas/${groupId}`);
  revalidatePath("/dashboard");
}

/**
 * Toda action aqui exige coordenação ou professor e confirma que a entidade
 * pertence à organização de quem chama. As queries do repositório usam
 * service-role (ignoram RLS), então esse par papel + org É a autorização real.
 *
 * Para o professor há uma segunda trava, porque "mesma escola" não é o
 * recorte dele: plano tem que ser de sua autoria, aula tem que ser sua e
 * turma tem que ser sua (`canTouchGroup`). O admin passa em todas.
 *
 * "Aula sua" tem duas medidas, e a diferença é deliberada: conduzir a aula
 * (`loadOwnedSession`) exige ser o professor escalado; mexer na agenda dela
 * (`loadManageableSession`) basta ser o titular da turma.
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

/**
 * Aula cuja *agenda* quem chama pode mexer — remarcar, cancelar, excluir.
 *
 * Recorte mais largo que o de `loadOwnedSession` de propósito: dar a aula é
 * do professor escalado, mas a agenda é da turma. O titular responde pelo
 * calendário da sua turma inteira, inclusive pela aula que a coordenação
 * passou para um substituto — senão a ficha da turma mostraria o menu de
 * ações e toda escolha morreria em "Aula não encontrada".
 */
async function loadManageableSession(
  ctx: Awaited<ReturnType<typeof requireStaff>>,
  sessionId: string,
) {
  const session = await planner.getPlannerSession(sessionId, ctx.organizationId);
  if (!session) return null;
  if (isAdmin(ctx)) return session;
  if (session.teacherId === ctx.userId) return session;
  return (await canTouchGroup(ctx, session.groupId)) ? session : null;
}

/**
 * Pasta do ateliê de quem chama. Estante é pessoal — nem o admin arquiva na
 * pasta dos outros —, então "existe" aqui significa "existe e é sua".
 */
async function ownsFolder(
  ctx: Awaited<ReturnType<typeof requireStaff>>,
  folderId: string,
): Promise<boolean> {
  return planner.isFolderOwnedBy(folderId, ctx.userId);
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
    folderId: formData.get("folderId"),
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }
  if (parsed.data.folderId && !(await ownsFolder(ctx, parsed.data.folderId)))
    return fail("NOT_FOUND", "Pasta não encontrada.");

  const id = await planner.createPlannerPlan(parsed.data, ctx.organizationId, ctx.userId);
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
    folderId: formData.get("folderId"),
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }
  if (parsed.data.folderId && !(await ownsFolder(ctx, parsed.data.folderId)))
    return fail("NOT_FOUND", "Pasta não encontrada.");

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

  const id = await planner.duplicatePlannerPlan(planId, ctx.organizationId, ctx.userId);
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

// --------------------------------------------------------------- pastas ----

/**
 * A estante é de quem a criou: todas as actions abaixo confirmam `owner_id`,
 * inclusive para o admin. Coordenação enxerga toda aula da escola, mas a
 * organização pessoal de cada professor não é dela para mexer.
 */

export async function createPlannerFolderAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireStaff();

  const parsed = plannerFolderSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color") || undefined,
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const { id, duplicate } = await planner.createPlannerFolder(
    parsed.data,
    ctx.organizationId,
    ctx.userId,
  );
  if (duplicate)
    return fail("CONFLICT", "Você já tem uma pasta com esse nome.", {
      name: ["Você já tem uma pasta com esse nome."],
    });
  if (!id) return fail("INTERNAL_ERROR", "Falha ao criar a pasta.");

  revalidateStaffPath(PLANNER_SUFFIX);
  return ok(undefined as never);
}

export async function updatePlannerFolderAction(
  folderId: string,
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireStaff();
  if (!(await ownsFolder(ctx, folderId)))
    return fail("NOT_FOUND", "Pasta não encontrada.");

  const parsed = plannerFolderSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color") || undefined,
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const { success, duplicate } = await planner.updatePlannerFolder(
    folderId,
    ctx.userId,
    parsed.data,
  );
  if (duplicate)
    return fail("CONFLICT", "Você já tem uma pasta com esse nome.", {
      name: ["Você já tem uma pasta com esse nome."],
    });
  if (!success) return fail("INTERNAL_ERROR", "Falha ao salvar a pasta.");

  revalidateStaffPath(PLANNER_SUFFIX);
  return ok(undefined as never);
}

/** Excluir a pasta desarquiva as aulas — nenhum plano é apagado junto. */
export async function deletePlannerFolderAction(
  folderId: string,
): Promise<ActionResult<never>> {
  const ctx = await requireStaff();
  if (!(await ownsFolder(ctx, folderId)))
    return fail("NOT_FOUND", "Pasta não encontrada.");

  const success = await planner.deletePlannerFolder(folderId, ctx.userId);
  if (!success) return fail("INTERNAL_ERROR", "Falha ao excluir a pasta.");

  revalidateStaffPath(PLANNER_SUFFIX);
  return ok(undefined as never);
}

/**
 * Arquivar a aula numa pasta. Exige as duas posses: o plano tem que ser
 * reescrevível por quem chama (`folder_id` é coluna do plano) e a pasta tem
 * que ser da estante dele.
 */
export async function movePlannerPlanAction(
  planId: string,
  folderId: string | null,
): Promise<ActionResult<never>> {
  const ctx = await requireStaff();
  if (!(await loadWritablePlan(ctx, planId)))
    return fail("FORBIDDEN", "Este plano não é seu.");

  const parsed = movePlannerPlanSchema.safeParse({ folderId });
  if (!parsed.success) return fail("VALIDATION_ERROR", "Pasta inválida.");
  if (parsed.data.folderId && !(await ownsFolder(ctx, parsed.data.folderId)))
    return fail("NOT_FOUND", "Pasta não encontrada.");

  const success = await planner.movePlannerPlanToFolder(
    planId,
    ctx.organizationId,
    parsed.data.folderId,
  );
  if (!success) return fail("INTERNAL_ERROR", "Falha ao mover a aula.");

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

  notifySessionScheduled({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    sessionId: id,
    groupId: parsed.data.groupId,
    teacherId,
    title: parsed.data.title,
    scheduledAt: toUtcIso(parsed.data.date, parsed.data.time),
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
  const session = await loadManageableSession(ctx, sessionId);
  if (!session) return fail("NOT_FOUND", "Aula não encontrada.");

  const parsed = rescheduleSessionSchema.safeParse({
    title: formData.get("title"),
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

  const scheduledAt = toUtcIso(parsed.data.date, parsed.data.time);

  // Duas aulas da mesma turma no mesmo instante quebram a prévia (que casa
  // horário a horário com a grade) e confundem a chamada. Salvar em cima do
  // próprio horário — só mudando duração ou título — continua valendo.
  if (
    scheduledAt !== session.scheduledAt &&
    (await planner.groupHasSessionAt(session.groupId, scheduledAt))
  ) {
    return fail("CONFLICT", "A turma já tem uma aula nesse horário.", {
      date: ["Já existe aula da turma nesse horário."],
    });
  }

  const success = await planner.reschedulePlannerSession(
    sessionId,
    ctx.organizationId,
    scheduledAt,
    parsed.data.durationMinutes,
    parsed.data.title,
  );
  if (!success) return fail("CONFLICT", "Só é possível remarcar aula agendada.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "SESSION_RESCHEDULE",
    entityType: "class_session",
    entityId: sessionId,
    metadata: { from: session.scheduledAt, to: scheduledAt },
  });

  notifySessionRescheduled({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    sessionId,
    groupId: session.groupId,
    teacherId: session.teacherId,
    title: parsed.data.title ?? session.title,
    scheduledAt,
  });

  revalidateSession(session.groupId);
  return ok(undefined as never);
}

/**
 * Cancelar não apaga: a aula fica na linha do tempo como "cancelada", o aluno
 * entende por que a semana caiu — e a geração automática não recria o horário,
 * porque ela pula qualquer instante que já tenha linha
 * (`0035_next_session_only.sql`). Para sumir de vez, `deleteSessionAction`.
 */
export async function cancelSessionAction(
  sessionId: string,
): Promise<ActionResult<never>> {
  const ctx = await requireStaff();
  const session = await loadManageableSession(ctx, sessionId);
  if (!session) return fail("NOT_FOUND", "Aula não encontrada.");

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

  notifySessionCancelled({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    sessionId,
    groupId: session.groupId,
    teacherId: session.teacherId,
    title: session.title,
    scheduledAt: session.scheduledAt,
  });

  revalidateSession(session.groupId);
  return ok(undefined as never);
}

/**
 * Apaga a aula da agenda. Só agendada ou cancelada: aula em andamento ou já
 * dada tem chamada, registro e PDF pendurados nela — apagá-la seria apagar
 * histórico, não desmarcar compromisso.
 *
 * Diferença prática para o cancelamento: sem a linha, o horário volta a ficar
 * livre e a grade da turma pode reagendá-lo automaticamente.
 */
export async function deleteSessionAction(
  sessionId: string,
): Promise<ActionResult<never>> {
  const ctx = await requireStaff();
  const session = await loadManageableSession(ctx, sessionId);
  if (!session) return fail("NOT_FOUND", "Aula não encontrada.");
  if (session.status === "in_progress" || session.status === "completed")
    return fail("CONFLICT", "Aula em andamento ou já dada não pode ser excluída.");

  // A notificação sai antes da linha sumir: depois do delete não haveria mais
  // sessão para o aviso apontar. Só faz sentido para quem esperava a aula.
  if (session.status === "scheduled") {
    notifySessionCancelled({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      sessionId,
      groupId: session.groupId,
      teacherId: session.teacherId,
      title: session.title,
      scheduledAt: session.scheduledAt,
    });
  }

  const success = await planner.deletePlannerSession(sessionId, ctx.organizationId);
  if (!success) return fail("INTERNAL_ERROR", "Falha ao excluir a aula.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "SESSION_DELETE",
    entityType: "class_session",
    entityId: sessionId,
    metadata: { groupId: session.groupId, scheduledAt: session.scheduledAt },
  });

  revalidateSession(session.groupId);
  return ok(undefined as never);
}

/**
 * A pergunta do fim da aula: "marca a próxima?". Quem encerrou responde com
 * data, hora e tema, e a aula seguinte nasce ali — na turma da aula que
 * acabou, no nome de quem a deu, sem passar pelo planejador.
 */
export async function scheduleNextSessionAction(
  sessionId: string,
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireStaff();

  const session = await loadOwnedSession(ctx, sessionId);
  if (!session) return fail("NOT_FOUND", "Aula não encontrada.");
  if (!(await canTouchGroup(ctx, session.groupId)))
    return fail("FORBIDDEN", "Esta turma não é sua.");

  const parsed = nextSessionSchema.safeParse({
    title: formData.get("title"),
    date: formData.get("date"),
    time: formData.get("time"),
    durationMinutes: formData.get("durationMinutes") || undefined,
    lessonPlanId: formData.get("lessonPlanId"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const scheduledAt = toUtcIso(parsed.data.date, parsed.data.time);
  if (new Date(scheduledAt).getTime() <= Date.now()) {
    return fail("VALIDATION_ERROR", "A próxima aula tem que ser no futuro.", {
      date: ["Escolha uma data à frente."],
    });
  }
  if (await planner.groupHasSessionAt(session.groupId, scheduledAt)) {
    return fail("CONFLICT", "A turma já tem uma aula nesse horário.", {
      date: ["Já existe aula da turma nesse horário."],
    });
  }

  // A aula seguinte fica com quem deu esta: quem encerrou é quem continua a
  // turma. Escalar outra pessoa é decisão de coordenação, feita no planejador.
  const id = await planner.schedulePlannerSession({
    organizationId: ctx.organizationId,
    groupId: session.groupId,
    teacherId: session.teacherId,
    lessonPlanId: parsed.data.lessonPlanId ?? null,
    title: parsed.data.title,
    scheduledAt,
    durationMinutes: parsed.data.durationMinutes,
    teacherNotes: parsed.data.notes ?? null,
  });
  if (!id) return fail("INTERNAL_ERROR", "Falha ao marcar a próxima aula.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "SESSION_SCHEDULE",
    entityType: "class_session",
    entityId: id,
    metadata: { groupId: session.groupId, afterSessionId: sessionId },
  });

  notifySessionScheduled({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    sessionId: id,
    groupId: session.groupId,
    teacherId: session.teacherId,
    title: parsed.data.title,
    scheduledAt,
  });

  revalidateSession(session.groupId);
  revalidateStaffPath(`${PLANNER_SUFFIX}/aula/${sessionId}`);
  revalidatePath(`/aula/${sessionId}`);
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

  notifySessionStarted({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    sessionId,
    groupId: session.groupId,
    title: session.title,
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

  notifySessionEnded({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    sessionId,
    groupId: session.groupId,
    title: session.title,
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

  notifyAttendanceRecorded({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    sessionId,
    title: session.title,
    entries: parsed.data.entries,
  });

  revalidateStaffPath(`${PLANNER_SUFFIX}/aula/${sessionId}`);
  return ok(undefined as never);
}

/**
 * Cola (ou remove) o link da gravação da aula.
 *
 * Só faz sentido depois que a aula acabou: é quando o Meet termina de
 * processar o vídeo e o link passa a existir. Por isso a única trava de
 * estado aqui é a inversa das outras actions — aula ainda não encerrada não
 * tem gravação para apontar.
 */
export async function saveSessionRecordingAction(
  sessionId: string,
  recordingUrl: string,
): Promise<ActionResult<{ recordingUrl: string | null }>> {
  const ctx = await requireStaff();

  const session = await loadOwnedSession(ctx, sessionId);
  if (!session) return fail("NOT_FOUND", "Aula não encontrada.");
  if (session.status !== "completed")
    return fail("CONFLICT", "A gravação só entra depois que a aula é encerrada.");

  const parsed = sessionRecordingSchema.safeParse({ recordingUrl });
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Link inválido.");
  }

  const value = parsed.data.recordingUrl.length > 0 ? parsed.data.recordingUrl : null;

  const success = await live.setRecordingUrl(sessionId, value);
  if (!success) return fail("INTERNAL_ERROR", "Falha ao salvar o link da gravação.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: value ? "SESSION_RECORDING_SET" : "SESSION_RECORDING_CLEAR",
    entityType: "class_session",
    entityId: sessionId,
    // O link inteiro fica de fora do rastro: o que importa auditar é quem
    // publicou a gravação de qual aula, não o endereço no Drive.
    metadata: { title: session.title },
  });

  revalidateStaffPath(`${PLANNER_SUFFIX}/aula/${sessionId}`);
  return ok({ recordingUrl: value });
}
