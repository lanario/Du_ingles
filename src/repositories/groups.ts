import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { CefrLevel } from "@/types/domain";
import type { CreateGroupInput, UpdateGroupInput } from "@/schemas/groups";

export interface GroupListItem {
  id: string;
  name: string;
  level: CefrLevel;
  teacherId: string;
  teacherName: string;
  courseId: string | null;
  courseName: string | null;
  maxStudents: number;
  enrolledCount: number;
  isActive: boolean;
}

export interface GroupDetail extends GroupListItem {
  schedule: { weekday: number; start: string; end: string }[];
  startDate: string | null;
  endDate: string | null;
}

/**
 * Lista com contagem de matrículas numa única query (join + count) — nunca
 * uma query por turma (§10.1, zero N+1).
 */
export async function listGroups(): Promise<GroupListItem[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("groups")
    .select(
      "id, name, level, max_students, is_active, course_id, teacher:teacher_id(id, full_name), course:course_id(name), enrollments(count)",
    )
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    level: row.level,
    teacherId: row.teacher?.id ?? "",
    teacherName: row.teacher?.full_name ?? "—",
    courseId: row.course_id,
    courseName: row.course?.name ?? null,
    maxStudents: row.max_students,
    enrolledCount: row.enrollments?.[0]?.count ?? 0,
    isActive: row.is_active,
  }));
}

/** Projeção completa usada pelas telas de Turmas da área logada. */
const GROUP_SELECT =
  "id, name, level, max_students, is_active, course_id, schedule, start_date, end_date, teacher:teacher_id(id, full_name), course:course_id(name), enrollments(count)";

interface GroupRow {
  id: string;
  name: string;
  level: CefrLevel;
  max_students: number;
  is_active: boolean;
  course_id: string | null;
  schedule: unknown;
  start_date: string | null;
  end_date: string | null;
  teacher: { id: string; full_name: string } | null;
  course: { name: string } | null;
  enrollments: { count: number }[] | null;
}

function mapGroupRow(row: GroupRow): GroupDetail {
  return {
    id: row.id,
    name: row.name,
    level: row.level,
    teacherId: row.teacher?.id ?? "",
    teacherName: row.teacher?.full_name ?? "—",
    courseId: row.course_id,
    courseName: row.course?.name ?? null,
    maxStudents: row.max_students,
    enrolledCount: row.enrollments?.[0]?.count ?? 0,
    isActive: row.is_active,
    schedule: (row.schedule as GroupDetail["schedule"]) ?? [],
    startDate: row.start_date,
    endDate: row.end_date,
  };
}

/** Turmas do professor logado, com horários e lotação — tela `/turmas`. */
export async function listGroupsByTeacher(teacherId: string): Promise<GroupDetail[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("groups")
    .select(GROUP_SELECT)
    .eq("teacher_id", teacherId)
    .order("is_active", { ascending: false })
    .order("name");

  if (error || !data) return [];
  return (data as unknown as GroupRow[]).map(mapGroupRow);
}

/**
 * Turmas por id, numa única query (`in`) — a tela do aluno primeiro resolve
 * as matrículas e depois hidrata as turmas em lote, nunca uma por vez.
 */
export async function listGroupsByIds(ids: string[]): Promise<GroupDetail[]> {
  if (ids.length === 0) return [];
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("groups")
    .select(GROUP_SELECT)
    .in("id", ids)
    .order("name");

  if (error || !data) return [];
  return (data as unknown as GroupRow[]).map(mapGroupRow);
}

/** Turmas ativas da organização — destino possível de uma troca. */
export async function listActiveGroups(): Promise<GroupDetail[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("groups")
    .select(GROUP_SELECT)
    .eq("is_active", true)
    .order("name");

  if (error || !data) return [];
  return (data as unknown as GroupRow[]).map(mapGroupRow);
}

/** Todas as turmas da organização, com horários e lotação — visão do admin. */
export async function listAllGroups(): Promise<GroupDetail[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("groups")
    .select(GROUP_SELECT)
    .order("is_active", { ascending: false })
    .order("name");

  if (error || !data) return [];
  return (data as unknown as GroupRow[]).map(mapGroupRow);
}

export interface MyGroupItem {
  id: string;
  name: string;
  level: CefrLevel;
}

/** Turmas do professor logado — usado nos seletores de Tarefas/Sala de aula. */
export async function listMyGroups(teacherId: string): Promise<MyGroupItem[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, level")
    .eq("teacher_id", teacherId)
    .eq("is_active", true)
    .order("name");

  if (error || !data) return [];
  return data;
}

export async function getGroupById(id: string): Promise<GroupDetail | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("groups")
    .select(
      "id, name, level, max_students, is_active, course_id, schedule, start_date, end_date, teacher:teacher_id(id, full_name), course:course_id(name), enrollments(count)",
    )
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.name,
    level: data.level,
    teacherId: data.teacher?.id ?? "",
    teacherName: data.teacher?.full_name ?? "—",
    courseId: data.course_id,
    courseName: data.course?.name ?? null,
    maxStudents: data.max_students,
    enrolledCount: data.enrollments?.[0]?.count ?? 0,
    isActive: data.is_active,
    schedule: (data.schedule as { weekday: number; start: string; end: string }[]) ?? [],
    startDate: data.start_date,
    endDate: data.end_date,
  };
}

export async function createGroup(
  input: CreateGroupInput,
  organizationId: string,
): Promise<{ success: boolean; groupId?: string; message?: string }> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("groups")
    .insert({
      organization_id: organizationId,
      course_id: input.courseId ?? null,
      teacher_id: input.teacherId,
      name: input.name,
      level: input.level as CefrLevel,
      max_students: input.maxStudents,
      schedule: input.schedule,
      start_date: input.startDate ?? null,
      end_date: input.endDate ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { success: false, message: "Falha ao criar a turma." };
  }

  // Gera as sessões das próximas 4 semanas imediatamente — não espera o
  // cron das 03:00 (critério de conclusão da Fase 4).
  await admin.rpc("generate_recurring_sessions", { p_group_id: data.id });

  return { success: true, groupId: data.id };
}

/**
 * Edição de turma. Regerar as sessões só quando a grade muda: `schedule`
 * ausente significa "não mexi nos horários", e regerar à toa apagaria/
 * recriaria sessões já vinculadas a planos de aula e presenças.
 */
export async function updateGroup(
  input: UpdateGroupInput,
): Promise<{ success: boolean; message?: string }> {
  const admin = createAdminSupabaseClient();

  const { error } = await admin
    .from("groups")
    .update({
      name: input.name,
      level: input.level as CefrLevel,
      max_students: input.maxStudents,
      course_id: input.courseId ?? null,
      start_date: input.startDate ?? null,
      end_date: input.endDate ?? null,
      is_active: input.isActive,
      updated_at: new Date().toISOString(),
      ...(input.teacherId ? { teacher_id: input.teacherId } : {}),
      ...(input.schedule ? { schedule: input.schedule } : {}),
    })
    .eq("id", input.id);
  if (error) return { success: false, message: "Falha ao salvar a turma." };

  if (input.schedule) {
    await admin.rpc("generate_recurring_sessions", { p_group_id: input.id });
  }

  return { success: true };
}

/**
 * Dono da turma. Usa service-role de proposito: a checagem de autorizacao
 * nao pode depender da RLS do proprio requisitante, senao "nao vejo a linha"
 * e "a linha nao e minha" viram o mesmo resultado.
 */
export async function isGroupOwnedByTeacher(
  groupId: string,
  teacherId: string,
): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("groups")
    .select("id")
    .eq("id", groupId)
    .eq("teacher_id", teacherId)
    .maybeSingle();
  return Boolean(data);
}

/** Professor responsavel por uma turma — destinatario do pedido de troca. */
export async function getGroupTeacherId(groupId: string): Promise<string | null> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("groups")
    .select("teacher_id")
    .eq("id", groupId)
    .maybeSingle();
  return data?.teacher_id ?? null;
}

/**
 * Arquivar/reativar uma turma. É um `update` de uma coluna só, separado de
 * `updateGroup` de propósito: alternar do cartão não pode arrastar junto a
 * regeração de sessões nem exigir o resto do formulário.
 */
export async function setGroupActive(
  groupId: string,
  isActive: boolean,
): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("groups")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", groupId);
  return !error;
}
