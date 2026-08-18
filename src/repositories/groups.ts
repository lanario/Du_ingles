import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { CefrLevel } from "@/types/domain";
import type { CreateGroupInput } from "@/schemas/groups";

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
