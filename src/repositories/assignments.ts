import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { AssignmentStatus } from "@/types/domain";

export interface AssignmentListItem {
  id: string;
  groupId: string;
  groupName: string;
  title: string;
  dueAt: string | null;
  maxScore: number | null;
  myStatus?: AssignmentStatus | null;
  myScore?: number | null;
}

export interface SubmissionRow {
  studentId: string;
  studentName: string;
  content: string | null;
  status: AssignmentStatus;
  score: number | null;
  feedback: string | null;
  submittedAt: string | null;
}

/** Turma → visão do professor (todas as tarefas que ele criou). */
export async function listGroupAssignments(
  groupId: string,
): Promise<AssignmentListItem[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("assignments")
    .select("id, group_id, title, due_at, max_score, group:group_id(name)")
    .eq("group_id", groupId)
    .order("due_at", { ascending: true, nullsFirst: false });

  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    groupId: row.group_id,
    groupName: row.group?.name ?? "—",
    title: row.title,
    dueAt: row.due_at,
    maxScore: row.max_score,
  }));
}

/** Aluno → todas as tarefas das turmas em que está matriculado, com o status da própria submissão. */
export async function listStudentAssignments(
  studentId: string,
): Promise<AssignmentListItem[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("assignments")
    .select(
      "id, group_id, title, due_at, max_score, group:group_id(name), submissions:assignment_submissions(status, score, student_id)",
    )
    .order("due_at", { ascending: true, nullsFirst: false });

  if (error || !data) return [];

  return data.map((row) => {
    const mine = row.submissions?.find((s) => s.student_id === studentId);
    return {
      id: row.id,
      groupId: row.group_id,
      groupName: row.group?.name ?? "—",
      title: row.title,
      dueAt: row.due_at,
      maxScore: row.max_score,
      myStatus: mine?.status ?? "pending",
      myScore: mine?.score ?? null,
    };
  });
}

export interface AssignmentDetail {
  id: string;
  groupId: string;
  groupName: string;
  title: string;
  dueAt: string | null;
  maxScore: number | null;
}

/** RLS (`assignments_select_teacher` / `assignments_select_student`) é a
 * única autorização aqui: se a linha voltar, quem chamou pode vê-la. */
export async function getAssignmentById(id: string): Promise<AssignmentDetail | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("assignments")
    .select("id, group_id, title, due_at, max_score, group:group_id(name)")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: data.id,
    groupId: data.group_id,
    groupName: data.group?.name ?? "—",
    title: data.title,
    dueAt: data.due_at,
    maxScore: data.max_score,
  };
}

export async function getAssignmentSubmissions(
  assignmentId: string,
): Promise<SubmissionRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("assignment_submissions")
    .select(
      "student_id, content, status, score, feedback, submitted_at, student:student_id(full_name)",
    )
    .eq("assignment_id", assignmentId);

  if (error || !data) return [];
  return data.map((row) => ({
    studentId: row.student_id,
    studentName: row.student?.full_name ?? "—",
    content: row.content,
    status: row.status,
    score: row.score,
    feedback: row.feedback,
    submittedAt: row.submitted_at,
  }));
}

export async function createAssignment(input: {
  groupId: string;
  title: string;
  dueAt?: string;
  maxScore: number;
  organizationId: string;
  createdBy: string;
}): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("assignments").insert({
    organization_id: input.organizationId,
    group_id: input.groupId,
    title: input.title,
    due_at: input.dueAt ?? null,
    max_score: input.maxScore,
    created_by: input.createdBy,
  });
  return !error;
}

export async function submitAssignment(
  assignmentId: string,
  studentId: string,
  organizationId: string,
  content: string,
): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("assignment_submissions").upsert(
    {
      organization_id: organizationId,
      assignment_id: assignmentId,
      student_id: studentId,
      content,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "assignment_id,student_id" },
  );
  return !error;
}

/** score/feedback/graded_at/graded_by têm UPDATE revogado de `authenticated`
 * (migration 0022, aluno não pode se auto-avaliar) — client normal não
 * consegue gravar a nota nem para o professor dono da turma. */
export async function gradeSubmission(
  assignmentId: string,
  studentId: string,
  gradedBy: string,
  score: number,
  feedback: string | undefined,
): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("assignment_submissions")
    .update({
      score,
      feedback: feedback ?? null,
      status: "graded",
      graded_at: new Date().toISOString(),
      graded_by: gradedBy,
    })
    .eq("assignment_id", assignmentId)
    .eq("student_id", studentId);
  return !error;
}
