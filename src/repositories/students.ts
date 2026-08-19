import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { CefrLevel } from "@/types/domain";

export interface StudentEnrollmentInfo {
  enrollmentId: string;
  groupId: string;
}

export interface StudentListItem {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  currentLevel: CefrLevel;
  guardianName: string | null;
  /** Matrícula ativa do aluno, quando existe — nunca mais de uma por vez. */
  enrollment: StudentEnrollmentInfo | null;
}

/**
 * Alunos da organização para a tela `/admin/alunos`, com o nível e a
 * matrícula ativa resolvidos em memória — três consultas planas em vez de
 * uma por aluno (§10.1). O nome e o nível da turma matriculada saem de
 * `listGroups()` (`repositories/groups.ts`), que a página já busca para a
 * barra de turmas; esta função só devolve `groupId`.
 */
export async function listStudents(organizationId: string): Promise<StudentListItem[]> {
  const admin = createAdminSupabaseClient();

  const [{ data: profiles }, { data: studentProfiles }, { data: enrollments }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("id, full_name, email, is_active, must_change_password, created_at")
        .eq("organization_id", organizationId)
        .eq("role", "student")
        .is("deleted_at", null)
        .order("full_name"),
      admin
        .from("student_profiles")
        .select("profile_id, current_level, guardian_name")
        .eq("organization_id", organizationId),
      admin
        .from("enrollments")
        .select("id, student_id, group_id")
        .eq("organization_id", organizationId)
        .eq("status", "active"),
    ]);

  const profileInfoById = new Map((studentProfiles ?? []).map((row) => [row.profile_id, row]));
  const enrollmentByStudent = new Map((enrollments ?? []).map((row) => [row.student_id, row]));

  return (profiles ?? []).map((row) => {
    const studentProfile = profileInfoById.get(row.id);
    const enrollment = enrollmentByStudent.get(row.id);

    return {
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      isActive: row.is_active,
      mustChangePassword: row.must_change_password,
      createdAt: row.created_at,
      currentLevel: studentProfile?.current_level ?? "A1",
      guardianName: studentProfile?.guardian_name ?? null,
      enrollment: enrollment ? { enrollmentId: enrollment.id, groupId: enrollment.group_id } : null,
    };
  });
}
