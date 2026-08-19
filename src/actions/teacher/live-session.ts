"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit";
import * as repo from "@/repositories/live-session";
import { recordAttendance } from "@/repositories/attendance";
import { recordAttendanceSchema } from "@/schemas/attendance";
import { generateSessionPdf } from "@/lib/pdf/generate";
import { fail, ok, type ActionResult } from "@/types/action-result";
import type { Json } from "@/types/database.types";

/** Toda action aqui repete a mesma checagem: buscar a sessão via
 * service-role e confirmar que `teacher_id` é quem está chamando — como
 * essas queries ignoram RLS, essa checagem manual É a autorização. */
async function loadOwnSession(sessionId: string, teacherId: string) {
  const session = await repo.getLiveSession(sessionId);
  if (!session || session.teacherId !== teacherId) return null;
  return session;
}

export async function startSessionAction(
  sessionId: string,
  lessonPlanId: string | null,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["teacher"]);

  const session = await loadOwnSession(sessionId, ctx.userId);
  if (!session) return fail("NOT_FOUND", "Sessão não encontrada.");
  if (session.status !== "scheduled")
    return fail("CONFLICT", "Esta aula já foi iniciada.");

  const success = await repo.startSession(sessionId, lessonPlanId);
  if (!success) return fail("INTERNAL_ERROR", "Falha ao iniciar a aula.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "SESSION_START",
    entityType: "class_session",
    entityId: sessionId,
  });

  revalidatePath(`/aula/${sessionId}`);
  return ok(undefined as never);
}

export async function endSessionAction(sessionId: string): Promise<ActionResult<never>> {
  const ctx = await requireRole(["teacher"]);

  const session = await loadOwnSession(sessionId, ctx.userId);
  if (!session) return fail("NOT_FOUND", "Sessão não encontrada.");
  if (session.status !== "in_progress")
    return fail("CONFLICT", "Esta aula não está em andamento.");

  const success = await repo.endSession(sessionId);
  if (!success) return fail("INTERNAL_ERROR", "Falha ao encerrar a aula.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "SESSION_END",
    entityType: "class_session",
    entityId: sessionId,
  });

  // Geração assíncrona: `after()` roda depois da resposta ser enviada, sem
  // travar a UI do professor (§8.4) — se falhar, o professor ainda pode
  // regenerar manualmente via POST /api/sessions/[id]/pdf.
  after(() => generateSessionPdf(sessionId));

  revalidatePath(`/aula/${sessionId}`);
  return ok(undefined as never);
}

export async function saveContentAction(
  sessionId: string,
  content: Json,
  teacherNotes?: string,
  homework?: string,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["teacher"]);

  const session = await loadOwnSession(sessionId, ctx.userId);
  if (!session) return fail("NOT_FOUND", "Sessão não encontrada.");
  if (session.status === "completed")
    return fail("CONFLICT", "Esta aula já foi encerrada.");

  const success = await repo.saveContent(sessionId, content, teacherNotes, homework);
  if (!success) return fail("INTERNAL_ERROR", "Falha ao salvar.");

  return ok(undefined as never);
}

export async function saveVersionAction(sessionId: string, content: Json): Promise<void> {
  const ctx = await requireRole(["teacher"]);

  const session = await loadOwnSession(sessionId, ctx.userId);
  if (!session) return;

  await repo.saveVersion(sessionId, content, ctx.userId);
}

export async function acquireLockAction(
  sessionId: string,
  clientId: string,
): Promise<{ acquired: boolean; heldBySomeoneElse: boolean }> {
  const ctx = await requireRole(["teacher"]);
  const session = await loadOwnSession(sessionId, ctx.userId);
  if (!session) return { acquired: false, heldBySomeoneElse: false };

  return repo.acquireLock(sessionId, clientId);
}

export async function recordAttendanceAction(
  sessionId: string,
  groupId: string,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["teacher"]);

  const session = await loadOwnSession(sessionId, ctx.userId);
  if (!session) return fail("NOT_FOUND", "Sessão não encontrada.");

  let entries: unknown;
  try {
    entries = JSON.parse(String(formData.get("entries")));
  } catch {
    return fail("VALIDATION_ERROR", "Dados de chamada inválidos.");
  }

  const parsed = recordAttendanceSchema.safeParse({ entries });
  if (!parsed.success) return fail("VALIDATION_ERROR", "Dados de chamada inválidos.");

  const success = await recordAttendance(
    sessionId,
    ctx.organizationId,
    ctx.userId,
    parsed.data.entries,
  );
  if (!success) return fail("INTERNAL_ERROR", "Falha ao salvar a chamada.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "ATTENDANCE_RECORD",
    entityType: "class_session",
    entityId: sessionId,
  });

  revalidatePath(`/aula/${sessionId}`);
  return ok(undefined as never);
}
