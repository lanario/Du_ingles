import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export interface EnrollmentListItem {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  status: string;
}

export async function listGroupEnrollments(
  groupId: string,
): Promise<EnrollmentListItem[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("enrollments")
    .select("id, status, student:student_id(id, full_name, email)")
    .eq("group_id", groupId)
    .order("enrolled_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    studentId: row.student?.id ?? "",
    studentName: row.student?.full_name ?? "—",
    studentEmail: row.student?.email ?? "",
    status: row.status,
  }));
}

export async function enrollStudent(
  groupId: string,
  studentId: string,
  organizationId: string,
): Promise<{ success: boolean; message?: string }> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("enrollments").insert({
    organization_id: organizationId,
    group_id: groupId,
    student_id: studentId,
  });
  if (error) {
    return {
      success: false,
      message:
        error.code === "23505"
          ? "Aluno já matriculado nesta turma."
          : "Falha ao matricular.",
    };
  }
  return { success: true };
}

/**
 * Todas as listas de uma vez (`in`) — a tela de Turmas do professor mostra
 * N turmas com N chamadas seria N+1 (§10.1).
 */
export async function listEnrollmentsForGroups(
  groupIds: string[],
): Promise<Record<string, EnrollmentListItem[]>> {
  if (groupIds.length === 0) return {};

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("enrollments")
    .select("id, status, group_id, student:student_id(id, full_name, email)")
    .in("group_id", groupIds)
    .order("enrolled_at", { ascending: false });

  if (error || !data) return {};

  const byGroup: Record<string, EnrollmentListItem[]> = {};
  for (const row of data) {
    (byGroup[row.group_id] ??= []).push({
      id: row.id,
      studentId: row.student?.id ?? "",
      studentName: row.student?.full_name ?? "—",
      studentEmail: row.student?.email ?? "",
      status: row.status,
    });
  }
  return byGroup;
}

export interface StudentEnrollmentItem {
  id: string;
  groupId: string;
  status: string;
  enrolledAt: string;
}

/** Matrículas do aluno logado — passa pela RLS `enrollments_select_self`. */
export async function listStudentEnrollments(
  studentId: string,
): Promise<StudentEnrollmentItem[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("enrollments")
    .select("id, group_id, status, enrolled_at")
    .eq("student_id", studentId)
    .order("enrolled_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    groupId: row.group_id,
    status: row.status,
    enrolledAt: row.enrolled_at,
  }));
}

/**
 * Move uma matrícula para outra turma. As checagens de lotação e de duplicata
 * ficam aqui (e não só no formulário) porque a Server Action é a fronteira
 * real de confiança — o cliente pode mandar qualquer par de ids.
 */
export async function transferStudent(
  enrollmentId: string,
  toGroupId: string,
): Promise<{ success: boolean; message?: string; studentId?: string }> {
  const admin = createAdminSupabaseClient();

  const { data: enrollment } = await admin
    .from("enrollments")
    .select("id, student_id, group_id, status")
    .eq("id", enrollmentId)
    .single();

  if (!enrollment) return { success: false, message: "Matrícula não encontrada." };
  if (enrollment.group_id === toGroupId)
    return { success: false, message: "O aluno já está nesta turma." };
  if (enrollment.status !== "active")
    return { success: false, message: "Só matrículas ativas podem ser transferidas." };

  const { data: target } = await admin
    .from("groups")
    .select("id, max_students, is_active")
    .eq("id", toGroupId)
    .single();

  if (!target) return { success: false, message: "Turma de destino não encontrada." };
  if (!target.is_active)
    return { success: false, message: "A turma de destino está inativa." };

  const { count } = await admin
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("group_id", toGroupId)
    .eq("status", "active");

  if ((count ?? 0) >= target.max_students)
    return { success: false, message: "A turma de destino está lotada." };

  const { error } = await admin
    .from("enrollments")
    .update({ group_id: toGroupId })
    .eq("id", enrollmentId);

  if (error) {
    return {
      success: false,
      message:
        error.code === "23505"
          ? "O aluno já tem matrícula nesta turma."
          : "Falha ao transferir.",
    };
  }

  return { success: true, studentId: enrollment.student_id };
}

export async function unenrollStudent(enrollmentId: string): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("enrollments")
    .update({ status: "cancelled" })
    .eq("id", enrollmentId);
  return !error;
}
