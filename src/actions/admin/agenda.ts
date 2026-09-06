"use server";

import { revalidatePath } from "next/cache";
import { fromZonedTime } from "date-fns-tz";
import { isAdmin } from "@/lib/auth/session";
import { canTouchGroup, requireStaff } from "@/lib/auth/staff";
import { revalidateStaffPath } from "@/lib/areas.server";
import { auditLog } from "@/lib/audit";
import { notifyAgendaEvent } from "@/lib/notifications/events";
import {
  notifySessionCancelled,
  notifySessionRescheduled,
} from "@/lib/notifications/events";
import * as agenda from "@/repositories/agenda";
import * as planner from "@/repositories/lesson-planner";
import { agendaEventSchema } from "@/schemas/agenda";
import { SCHOOL_TZ } from "@/lib/schedule/session-preview";
import { fail, ok, type ActionResult } from "@/types/action-result";
import type { AgendaAudience } from "@/types/domain";

/**
 * Escritas da agenda.
 *
 * A regra de quem pode o quê é a mesma que o repositório usa para montar a
 * tela (`repositories/agenda.ts`), repetida aqui porque as duas respondem a
 * perguntas diferentes: lá é "o que desenho", aqui é "o que aceito gravar".
 * Botão escondido não é autorização.
 *
 *   • admin      — tudo, em qualquer turma, inclusive o que é da escola toda.
 *   • professor  — só o que é da turma dele. Nunca compromisso sem turma.
 *   • aluno      — nada: `requireStaff` já o barra antes de qualquer parse.
 *
 * As aulas continuam sendo remarcadas/canceladas pelas funções do planejador
 * — a agenda é outra porta para a mesma operação, não outra regra.
 */

const AGENDA_SUFFIX = "/agenda";

function toUtcIso(date: string, time: string): string {
  return fromZonedTime(`${date}T${time}:00`, SCHOOL_TZ).toISOString();
}

/** A mesma agenda existe em três caminhos; uma escrita muda os três. */
function revalidateAgenda(): void {
  revalidateStaffPath(AGENDA_SUFFIX);
  revalidatePath(AGENDA_SUFFIX);
  revalidatePath("/dashboard");
}

function parseEvent(formData: FormData) {
  return agendaEventSchema.safeParse({
    title: formData.get("title"),
    kind: formData.get("kind") || undefined,
    audience: formData.get("audience") || undefined,
    groupId: formData.get("groupId"),
    date: formData.get("date"),
    time: formData.get("time"),
    durationMinutes: formData.get("durationMinutes") || undefined,
    allDay: formData.get("allDay") ?? false,
    location: formData.get("location"),
    description: formData.get("description"),
  });
}

/**
 * Compromisso sem turma é da escola inteira — decisão de coordenação. O
 * professor tem que dizer para qual das turmas dele está marcando.
 */
async function authorizeScope(
  ctx: Awaited<ReturnType<typeof requireStaff>>,
  groupId: string | undefined,
): Promise<ActionResult<never> | null> {
  if (!groupId) {
    return isAdmin(ctx)
      ? null
      : fail("FORBIDDEN", "Escolha uma das suas turmas para este compromisso.", {
          groupId: ["Selecione a turma."],
        });
  }
  return (await canTouchGroup(ctx, groupId))
    ? null
    : fail("FORBIDDEN", "Esta turma não é sua.", { groupId: ["Turma indisponível."] });
}

export async function createAgendaEventAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireStaff();

  const parsed = parseEvent(formData);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const denied = await authorizeScope(ctx, parsed.data.groupId);
  if (denied) return denied;

  const startsAt = toUtcIso(parsed.data.date, parsed.data.time);
  const groupId = parsed.data.groupId ?? null;

  const id = await agenda.createAgendaEvent({
    organizationId: ctx.organizationId,
    createdBy: ctx.userId,
    // O compromisso do professor é dele; o da coordenação é da escola e não
    // fica pendurado num nome que pode sair da equipe amanhã.
    ownerId: isAdmin(ctx) ? null : ctx.userId,
    groupId,
    data: parsed.data,
    startsAt,
  });
  if (!id) return fail("INTERNAL_ERROR", "Falha ao criar o compromisso.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "AGENDA_EVENT_CREATE",
    entityType: "agenda_event",
    entityId: id,
    metadata: { groupId, kind: parsed.data.kind },
  });

  notifyAgendaEvent({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    groupId,
    audience: parsed.data.audience as AgendaAudience,
    title: parsed.data.title,
    startsAt,
    allDay: parsed.data.allDay,
    change: "created",
  });

  revalidateAgenda();
  return ok(undefined as never);
}

export async function updateAgendaEventAction(
  eventId: string,
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireStaff();

  const existing = await agenda.getAgendaEventOwner(eventId);
  if (!existing || existing.organizationId !== ctx.organizationId)
    return fail("NOT_FOUND", "Compromisso não encontrado.");

  // Duas checagens, não uma: o professor precisa poder mexer no compromisso
  // onde ele está HOJE e no lugar para onde quer movê-lo. Sem a primeira, ele
  // "adotaria" um compromisso da escola mudando o campo de turma.
  const deniedCurrent = await authorizeScope(ctx, existing.groupId ?? undefined);
  if (deniedCurrent) return deniedCurrent;

  const parsed = parseEvent(formData);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const deniedTarget = await authorizeScope(ctx, parsed.data.groupId);
  if (deniedTarget) return deniedTarget;

  const startsAt = toUtcIso(parsed.data.date, parsed.data.time);
  const groupId = parsed.data.groupId ?? null;

  const success = await agenda.updateAgendaEvent({
    id: eventId,
    organizationId: ctx.organizationId,
    groupId,
    data: parsed.data,
    startsAt,
  });
  if (!success) return fail("INTERNAL_ERROR", "Falha ao salvar o compromisso.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "AGENDA_EVENT_UPDATE",
    entityType: "agenda_event",
    entityId: eventId,
    metadata: { groupId, kind: parsed.data.kind },
  });

  notifyAgendaEvent({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    groupId,
    audience: parsed.data.audience as AgendaAudience,
    title: parsed.data.title,
    startsAt,
    allDay: parsed.data.allDay,
    change: "updated",
  });

  revalidateAgenda();
  return ok(undefined as never);
}

export async function deleteAgendaEventAction(
  eventId: string,
): Promise<ActionResult<never>> {
  const ctx = await requireStaff();

  const existing = await agenda.getAgendaEventOwner(eventId);
  if (!existing || existing.organizationId !== ctx.organizationId)
    return fail("NOT_FOUND", "Compromisso não encontrado.");

  const denied = await authorizeScope(ctx, existing.groupId ?? undefined);
  if (denied) return denied;

  const success = await agenda.deleteAgendaEvent(eventId, ctx.organizationId);
  if (!success) return fail("INTERNAL_ERROR", "Falha ao excluir o compromisso.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "AGENDA_EVENT_DELETE",
    entityType: "agenda_event",
    entityId: eventId,
    metadata: { groupId: existing.groupId },
  });

  revalidateAgenda();
  return ok(undefined as never);
}

// ---------------------------------------------------------------- aulas ----

/**
 * Aula que quem chama pode mexer PELA AGENDA: a coordenação em qualquer uma,
 * o professor na aula dele ou na aula da turma dele.
 *
 * O corte por turma (e não só por `teacher_id`, como no planejador) é o que o
 * cliente pediu — "professores editam as aulas da turma relacionada a ele" —
 * e cobre a aula que ficou com o professor anterior depois de uma troca de
 * responsável.
 */
async function loadWritableSession(
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
 * Arrastar/soltar e o formulário de detalhe caem aqui. Só horário e duração:
 * mudar título ou turma continua sendo trabalho do planejador, que é onde a
 * aula tem plano, chamada e registro pendurados.
 */
export async function moveSessionAction(
  sessionId: string,
  date: string,
  time: string,
  durationMinutes: number,
): Promise<ActionResult<never>> {
  const ctx = await requireStaff();

  const session = await loadWritableSession(ctx, sessionId);
  if (!session) return fail("NOT_FOUND", "Aula não encontrada.");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time))
    return fail("VALIDATION_ERROR", "Data ou horário inválidos.");
  if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 240)
    return fail("VALIDATION_ERROR", "Duração fora do intervalo permitido.");

  const scheduledAt = toUtcIso(date, time);

  // Mesma trava do planejador: duas aulas da turma no mesmo instante quebram
  // a prévia da grade e confundem a chamada.
  if (
    scheduledAt !== session.scheduledAt &&
    (await planner.groupHasSessionAt(session.groupId, scheduledAt))
  ) {
    return fail("CONFLICT", "A turma já tem uma aula nesse horário.");
  }

  const success = await planner.reschedulePlannerSession(
    sessionId,
    ctx.organizationId,
    scheduledAt,
    durationMinutes,
  );
  if (!success) return fail("CONFLICT", "Só é possível remarcar aula agendada.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "SESSION_RESCHEDULE",
    entityType: "class_session",
    entityId: sessionId,
    metadata: { from: session.scheduledAt, to: scheduledAt, source: "agenda" },
  });

  notifySessionRescheduled({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    sessionId,
    groupId: session.groupId,
    teacherId: session.teacherId,
    title: session.title,
    scheduledAt,
  });

  revalidateAgenda();
  revalidateStaffPath("/planejador");
  revalidateStaffPath(`/turmas/${session.groupId}`);
  return ok(undefined as never);
}

/**
 * Cancelar pela agenda apaga a linha (é o que `cancelPlannerSession` faz) —
 * o horário some do calendário de todo mundo e a grade pode reagendá-lo.
 */
export async function removeSessionAction(
  sessionId: string,
): Promise<ActionResult<never>> {
  const ctx = await requireStaff();

  const session = await loadWritableSession(ctx, sessionId);
  if (!session) return fail("NOT_FOUND", "Aula não encontrada.");
  if (session.status !== "scheduled")
    return fail("CONFLICT", "Só é possível desmarcar aula ainda agendada.");

  // O aviso sai antes da linha sumir: depois do delete não haveria mais aula
  // para o alerta descrever.
  notifySessionCancelled({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    sessionId,
    groupId: session.groupId,
    teacherId: session.teacherId,
    title: session.title,
    scheduledAt: session.scheduledAt,
  });

  const success = await planner.cancelPlannerSession(sessionId, ctx.organizationId);
  if (!success) return fail("CONFLICT", "Só é possível desmarcar aula agendada.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "SESSION_CANCEL",
    entityType: "class_session",
    entityId: sessionId,
    metadata: { source: "agenda" },
  });

  revalidateAgenda();
  revalidateStaffPath("/planejador");
  revalidateStaffPath(`/turmas/${session.groupId}`);
  return ok(undefined as never);
}
