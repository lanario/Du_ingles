import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import type { SessionStatus } from "@/types/domain";

export interface LiveSessionDetail {
  id: string;
  groupId: string;
  groupName: string;
  teacherId: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  startedAt: string | null;
  endedAt: string | null;
  status: SessionStatus;
  isPublished: boolean;
  content: Json;
  teacherNotes: string | null;
  homework: string | null;
  lockedBy: string | null;
  lockedAt: string | null;
  pdfPath: string | null;
}

/**
 * Só lê teacher_notes/homework via service-role (a coluna teacher_notes tem
 * o SELECT revogado de authenticated/anon — ver migration 0015). Quem chama
 * isto TEM que já ter confirmado que `teacherId` é o dono da sessão.
 */
export async function getLiveSession(
  sessionId: string,
): Promise<LiveSessionDetail | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("class_sessions")
    .select(
      "id, group_id, teacher_id, title, scheduled_at, duration_minutes, started_at, ended_at, status, is_published, content, teacher_notes, homework, locked_by, locked_at, pdf_path, group:group_id(name)",
    )
    .eq("id", sessionId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    groupId: data.group_id,
    groupName: data.group?.name ?? "—",
    teacherId: data.teacher_id,
    title: data.title,
    scheduledAt: data.scheduled_at,
    durationMinutes: data.duration_minutes,
    startedAt: data.started_at,
    endedAt: data.ended_at,
    status: data.status,
    isPublished: data.is_published,
    content: data.content,
    teacherNotes: data.teacher_notes,
    homework: data.homework,
    lockedBy: data.locked_by,
    lockedAt: data.locked_at,
    pdfPath: data.pdf_path,
  };
}

/** Snapshot do plano de aula (§4.1) — content é COPIADO, nunca referenciado. */
export async function startSession(
  sessionId: string,
  lessonPlanId: string | null,
): Promise<boolean> {
  const admin = createAdminSupabaseClient();

  let content: Json = { type: "doc", content: [] };
  if (lessonPlanId) {
    const { data: plan } = await admin
      .from("lesson_plans")
      .select("content")
      .eq("id", lessonPlanId)
      .single();
    if (plan) content = plan.content;
  }

  const { error } = await admin
    .from("class_sessions")
    .update({
      status: "in_progress",
      started_at: new Date().toISOString(),
      lesson_plan_id: lessonPlanId,
      content,
    })
    .eq("id", sessionId);

  return !error;
}

export async function endSession(sessionId: string): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("class_sessions")
    .update({
      status: "completed",
      ended_at: new Date().toISOString(),
      is_published: true,
      locked_by: null,
      locked_at: null,
    })
    .eq("id", sessionId);
  return !error;
}

export async function saveContent(
  sessionId: string,
  content: Json,
  teacherNotes: string | undefined,
  homework: string | undefined,
): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("class_sessions")
    .update({
      content,
      ...(teacherNotes !== undefined ? { teacher_notes: teacherNotes } : {}),
      ...(homework !== undefined ? { homework } : {}),
    })
    .eq("id", sessionId);
  return !error;
}

const LOCK_TTL_MS = 60_000;

/** Lock leve só contra o MESMO professor com duas abas abertas (§8.3). */
export async function acquireLock(
  sessionId: string,
  clientId: string,
): Promise<{ acquired: boolean; heldBySomeoneElse: boolean }> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("class_sessions")
    .select("locked_by, locked_at")
    .eq("id", sessionId)
    .single();

  const now = Date.now();
  const lockedAt = data?.locked_at ? new Date(data.locked_at).getTime() : 0;
  const isStale = now - lockedAt > LOCK_TTL_MS;
  const heldBySomeoneElse = !!data?.locked_by && data.locked_by !== clientId && !isStale;

  if (heldBySomeoneElse) {
    return { acquired: false, heldBySomeoneElse: true };
  }

  await admin
    .from("class_sessions")
    .update({ locked_by: clientId, locked_at: new Date().toISOString() })
    .eq("id", sessionId);

  return { acquired: true, heldBySomeoneElse: false };
}

export async function saveVersion(
  sessionId: string,
  content: Json,
  createdBy: string,
): Promise<void> {
  const admin = createAdminSupabaseClient();
  await admin.from("session_content_versions").insert({
    session_id: sessionId,
    content,
    created_by: createdBy,
  });

  // Mantém só as 20 versões mais recentes por sessão (§4.4).
  const { data: old } = await admin
    .from("session_content_versions")
    .select("id")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .range(20, 1000);

  if (old && old.length > 0) {
    await admin
      .from("session_content_versions")
      .delete()
      .in(
        "id",
        old.map((v) => v.id),
      );
  }
}

export interface SessionVersion {
  id: string;
  content: Json;
  createdAt: string;
}

export async function listVersions(sessionId: string): Promise<SessionVersion[]> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("session_content_versions")
    .select("id, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(20);

  return (data ?? []).map((v) => ({
    id: v.id,
    content: v.content,
    createdAt: v.created_at,
  }));
}
