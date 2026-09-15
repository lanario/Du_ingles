import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * Objetivos de aprendizado (0047_learning_objectives): sempre com um alvo só,
 * turma OU aluno — nunca os dois, nunca nenhum (ver o check da tabela).
 */

export interface ObjectiveItem {
  id: string;
  scope: "group" | "student";
  groupId: string | null;
  groupName: string | null;
  studentId: string | null;
  title: string;
  description: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  createdBy: string;
  createdAt: string;
}

const SELECT =
  "id, group_id, student_id, title, description, is_completed, completed_at, created_by, created_at, group:group_id(name)";

interface ObjectiveRow {
  id: string;
  group_id: string | null;
  student_id: string | null;
  title: string;
  description: string | null;
  is_completed: boolean;
  completed_at: string | null;
  created_by: string;
  created_at: string;
  group: { name: string } | null;
}

function mapRow(row: ObjectiveRow): ObjectiveItem {
  return {
    id: row.id,
    scope: row.group_id ? "group" : "student",
    groupId: row.group_id,
    groupName: row.group?.name ?? null,
    studentId: row.student_id,
    title: row.title,
    description: row.description,
    isCompleted: row.is_completed,
    completedAt: row.completed_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

const ORDER = [
  { column: "is_completed", ascending: true },
  { column: "created_at", ascending: false },
] as const;

/** Turma → objetivos atribuídos a ela — tela de turma (admin/professor). */
export async function listGroupObjectives(groupId: string): Promise<ObjectiveItem[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase.from("learning_objectives").select(SELECT).eq("group_id", groupId);
  for (const order of ORDER) query = query.order(order.column, order);
  const { data, error } = await query;
  if (error || !data) return [];
  return data.map(mapRow);
}

/**
 * Ficha do aluno (admin/professor): os objetivos dele diretos, mais os da
 * turma em que está matriculado agora — a mesma coisa que ele próprio vê em
 * `listMyObjectives`, só que resolvida com service-role porque quem pergunta
 * não é o aluno.
 */
export async function listVisibleObjectivesForStudent(
  studentId: string,
): Promise<ObjectiveItem[]> {
  const admin = createAdminSupabaseClient();
  const { data: enrollment } = await admin
    .from("enrollments")
    .select("group_id")
    .eq("student_id", studentId)
    .eq("status", "active")
    .order("enrolled_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const groupId = enrollment?.group_id ?? null;
  const filter = groupId
    ? `student_id.eq.${studentId},group_id.eq.${groupId}`
    : `student_id.eq.${studentId}`;

  let query = admin.from("learning_objectives").select(SELECT).or(filter);
  for (const order of ORDER) query = query.order(order.column, order);
  const { data, error } = await query;
  if (error || !data) return [];
  return data.map(mapRow);
}

/**
 * Aluno: os próprios objetivos. A RLS (`learning_objectives_select_student`)
 * já resolve o "direto OU da minha turma" no banco — aqui é só pedir.
 */
export async function listMyObjectives(): Promise<ObjectiveItem[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase.from("learning_objectives").select(SELECT);
  for (const order of ORDER) query = query.order(order.column, order);
  const { data, error } = await query;
  if (error || !data) return [];
  return data.map(mapRow);
}

export async function createGroupObjective(input: {
  groupId: string;
  title: string;
  description: string | null;
  organizationId: string;
  createdBy: string;
}): Promise<string | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("learning_objectives")
    .insert({
      organization_id: input.organizationId,
      group_id: input.groupId,
      title: input.title,
      description: input.description,
      created_by: input.createdBy,
    })
    .select("id")
    .single();
  return error || !data ? null : data.id;
}

export async function createStudentObjective(input: {
  studentId: string;
  title: string;
  description: string | null;
  organizationId: string;
  createdBy: string;
}): Promise<string | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("learning_objectives")
    .insert({
      organization_id: input.organizationId,
      student_id: input.studentId,
      title: input.title,
      description: input.description,
      created_by: input.createdBy,
    })
    .select("id")
    .single();
  return error || !data ? null : data.id;
}

export interface ObjectiveOwnership {
  id: string;
  groupId: string | null;
  studentId: string | null;
  title: string;
}

/** Para `canTouchGroup`/`canSeeStudent` antes de concluir ou excluir. */
export async function getObjectiveForOwnershipCheck(
  id: string,
  organizationId: string,
): Promise<ObjectiveOwnership | null> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("learning_objectives")
    .select("id, group_id, student_id, title")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  return data
    ? {
        id: data.id,
        groupId: data.group_id,
        studentId: data.student_id,
        title: data.title,
      }
    : null;
}

export async function setObjectiveCompleted(
  id: string,
  organizationId: string,
  completed: boolean,
  completedBy: string,
): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("learning_objectives")
    .update({
      is_completed: completed,
      completed_at: completed ? new Date().toISOString() : null,
      completed_by: completed ? completedBy : null,
    })
    .eq("id", id)
    .eq("organization_id", organizationId);
  return !error;
}

export async function deleteObjective(
  id: string,
  organizationId: string,
): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("learning_objectives")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId);
  return !error;
}
