import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import type { AttendanceStatus, CefrLevel, SessionStatus } from "@/types/domain";
import type { AttendanceRow } from "@/repositories/attendance";
import type { PlannerPlanInput } from "@/schemas/lesson-planner";

/**
 * Planejador da área admin. Ao contrário de `repositories/lesson-plans`
 * (RLS: próprios + compartilhados) e de `repositories/class-sessions` (RLS:
 * minhas turmas), aqui a leitura é da escola inteira — o admin planeja e
 * agenda para qualquer turma, inclusive aulas que não são dele.
 *
 * Por isso tudo passa pelo service-role com `organization_id` explícito em
 * TODA query: a checagem de papel acontece na action, e o filtro de org aqui
 * é o que impede um id de outra escola de ser lido ou escrito.
 */

const EMPTY_DOC: Json = { type: "doc", content: [] };

export interface PlannerPlan {
  id: string;
  title: string;
  summary: string | null;
  level: CefrLevel;
  durationMinutes: number;
  isShared: boolean;
  authorId: string;
  authorName: string;
  updatedAt: string;
  /** Quantas aulas já foram agendadas a partir deste plano. */
  scheduledCount: number;
}

export interface PlannerPlanDetail extends PlannerPlan {
  content: Json;
}

export interface PlannerSession {
  id: string;
  title: string;
  groupId: string;
  groupName: string;
  teacherId: string;
  teacherName: string;
  lessonPlanId: string | null;
  planTitle: string | null;
  scheduledAt: string;
  durationMinutes: number;
  status: SessionStatus;
  isPublished: boolean;
  studentCount: number;
}

const PLAN_SELECT =
  "id, title, summary, level, duration_minutes, is_shared, author_id, updated_at, author:author_id(full_name), sessions:class_sessions(count)";

interface PlanRow {
  id: string;
  title: string;
  summary: string | null;
  level: CefrLevel;
  duration_minutes: number;
  is_shared: boolean;
  author_id: string;
  updated_at: string;
  author: { full_name: string } | null;
  sessions: { count: number }[] | null;
}

function mapPlan(row: PlanRow): PlannerPlan {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    level: row.level,
    durationMinutes: row.duration_minutes,
    isShared: row.is_shared,
    authorId: row.author_id,
    authorName: row.author?.full_name ?? "—",
    updatedAt: row.updated_at,
    scheduledCount: row.sessions?.[0]?.count ?? 0,
  };
}

export async function listPlannerPlans(organizationId: string): Promise<PlannerPlan[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("lesson_plans")
    .select(PLAN_SELECT)
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row) => mapPlan(row as unknown as PlanRow));
}

export async function getPlannerPlan(
  id: string,
  organizationId: string,
): Promise<PlannerPlanDetail | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("lesson_plans")
    .select(`${PLAN_SELECT}, content`)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single();

  if (error || !data) return null;
  const row = data as unknown as PlanRow & { content: Json };
  return { ...mapPlan(row), content: row.content ?? EMPTY_DOC };
}

export async function createPlannerPlan(
  input: PlannerPlanInput,
  organizationId: string,
  authorId: string,
): Promise<string | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("lesson_plans")
    .insert({
      organization_id: organizationId,
      author_id: authorId,
      title: input.title,
      summary: input.summary ?? null,
      level: input.level as CefrLevel,
      duration_minutes: input.durationMinutes,
      is_shared: input.isShared,
      content: EMPTY_DOC,
    })
    .select("id")
    .single();

  if (error || !data) return null;
  return data.id;
}

export async function updatePlannerPlanMeta(
  id: string,
  organizationId: string,
  input: PlannerPlanInput,
): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("lesson_plans")
    .update({
      title: input.title,
      summary: input.summary ?? null,
      level: input.level as CefrLevel,
      duration_minutes: input.durationMinutes,
      is_shared: input.isShared,
    })
    .eq("id", id)
    .eq("organization_id", organizationId);
  return !error;
}

export async function updatePlannerPlanContent(
  id: string,
  organizationId: string,
  content: Json,
): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("lesson_plans")
    .update({ content })
    .eq("id", id)
    .eq("organization_id", organizationId);
  return !error;
}

export async function duplicatePlannerPlan(
  id: string,
  organizationId: string,
  authorId: string,
): Promise<string | null> {
  const admin = createAdminSupabaseClient();
  const { data: original } = await admin
    .from("lesson_plans")
    .select("title, summary, level, duration_minutes, objectives, content, tags")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single();

  if (!original) return null;

  const { data, error } = await admin
    .from("lesson_plans")
    .insert({
      organization_id: organizationId,
      author_id: authorId,
      title: `${original.title} (cópia)`,
      summary: original.summary,
      level: original.level,
      duration_minutes: original.duration_minutes,
      objectives: original.objectives,
      content: original.content,
      tags: original.tags,
    })
    .select("id")
    .single();

  if (error || !data) return null;
  return data.id;
}

export async function deletePlannerPlan(
  id: string,
  organizationId: string,
): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("lesson_plans")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId);
  return !error;
}

const SESSION_SELECT =
  "id, title, group_id, teacher_id, lesson_plan_id, scheduled_at, duration_minutes, status, is_published, " +
  "group:group_id(name, enrollments(count)), teacher:teacher_id(full_name), plan:lesson_plan_id(title)";

interface SessionRow {
  id: string;
  title: string;
  group_id: string;
  teacher_id: string;
  lesson_plan_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: SessionStatus;
  is_published: boolean;
  group: { name: string; enrollments: { count: number }[] | null } | null;
  teacher: { full_name: string } | null;
  plan: { title: string } | null;
}

function mapSession(row: SessionRow): PlannerSession {
  return {
    id: row.id,
    title: row.title,
    groupId: row.group_id,
    groupName: row.group?.name ?? "—",
    teacherId: row.teacher_id,
    teacherName: row.teacher?.full_name ?? "—",
    lessonPlanId: row.lesson_plan_id,
    planTitle: row.plan?.title ?? null,
    scheduledAt: row.scheduled_at,
    durationMinutes: row.duration_minutes,
    status: row.status,
    isPublished: row.is_published,
    studentCount: row.group?.enrollments?.[0]?.count ?? 0,
  };
}

/** Janela ampla (passado recente + futuro) para a agenda filtrar em memória. */
export async function listPlannerSessions(
  organizationId: string,
  options: { from?: string; limit?: number } = {},
): Promise<PlannerSession[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("class_sessions")
    .select(SESSION_SELECT)
    .eq("organization_id", organizationId)
    .gte(
      "scheduled_at",
      options.from ?? new Date(Date.now() - 45 * 24 * 3600_000).toISOString(),
    )
    .order("scheduled_at", { ascending: true })
    .limit(options.limit ?? 300);

  if (error || !data) return [];
  return data.map((row) => mapSession(row as unknown as SessionRow));
}

export async function getPlannerSession(
  id: string,
  organizationId: string,
): Promise<PlannerSession | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("class_sessions")
    .select(SESSION_SELECT)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single();

  if (error || !data) return null;
  return mapSession(data as unknown as SessionRow);
}

export async function schedulePlannerSession(input: {
  organizationId: string;
  groupId: string;
  teacherId: string;
  lessonPlanId: string | null;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
}): Promise<string | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("class_sessions")
    .insert({
      organization_id: input.organizationId,
      group_id: input.groupId,
      teacher_id: input.teacherId,
      lesson_plan_id: input.lessonPlanId,
      title: input.title,
      scheduled_at: input.scheduledAt,
      duration_minutes: input.durationMinutes,
    })
    .select("id")
    .single();

  if (error || !data) return null;
  return data.id;
}

export async function reschedulePlannerSession(
  id: string,
  organizationId: string,
  scheduledAt: string,
  durationMinutes: number,
): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("class_sessions")
    .update({ scheduled_at: scheduledAt, duration_minutes: durationMinutes })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("status", "scheduled");
  return !error;
}

export async function cancelPlannerSession(
  id: string,
  organizationId: string,
): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("class_sessions")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("status", "scheduled");
  return !error;
}

/**
 * Chamada pelo admin. As policies de `attendance` são escritas para o
 * professor da turma; o admin do planejador pode estar dando a aula de
 * outra pessoa, então a leitura e a escrita passam pelo service-role com a
 * organização checada antes, na action.
 */
export async function listPlannerAttendance(
  sessionId: string,
  groupId: string,
): Promise<AttendanceRow[]> {
  const admin = createAdminSupabaseClient();

  const [{ data: enrollments }, { data: attendance }] = await Promise.all([
    admin
      .from("enrollments")
      .select("student:student_id(id, full_name)")
      .eq("group_id", groupId)
      .eq("status", "active"),
    admin.from("attendance").select("student_id, status").eq("session_id", sessionId),
  ]);

  const statusByStudent = new Map((attendance ?? []).map((row) => [row.student_id, row.status]));

  return (enrollments ?? [])
    .filter((row) => row.student)
    .map((row) => ({
      studentId: row.student!.id,
      studentName: row.student!.full_name,
      status: statusByStudent.get(row.student!.id) ?? null,
    }));
}

export async function recordPlannerAttendance(
  sessionId: string,
  organizationId: string,
  recordedBy: string,
  entries: { studentId: string; status: AttendanceStatus }[],
): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("attendance").upsert(
    entries.map((entry) => ({
      organization_id: organizationId,
      session_id: sessionId,
      student_id: entry.studentId,
      status: entry.status,
      recorded_by: recordedBy,
    })),
    { onConflict: "session_id,student_id" },
  );
  return !error;
}

export interface PlannerGroupOption {
  id: string;
  name: string;
  level: CefrLevel;
  teacherId: string;
  teacherName: string;
  studentCount: number;
}

/** Turmas ativas com professor — origem dos selects de agendamento. */
export async function listPlannerGroups(
  organizationId: string,
): Promise<PlannerGroupOption[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("groups")
    .select(
      "id, name, level, teacher_id, teacher:teacher_id(full_name), enrollments(count)",
    )
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    level: row.level,
    teacherId: row.teacher_id,
    teacherName: row.teacher?.full_name ?? "—",
    studentCount: row.enrollments?.[0]?.count ?? 0,
  }));
}
