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

export async function unenrollStudent(enrollmentId: string): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("enrollments")
    .update({ status: "cancelled" })
    .eq("id", enrollmentId);
  return !error;
}
