import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { CefrLevel } from "@/types/domain";

export interface GroupProgress {
  groupId: string;
  groupName: string;
  attendanceRate: number;
}

export interface GradedAssignmentRow {
  title: string;
  groupName: string;
  score: number | null;
  maxScore: number | null;
  gradedAt: string | null;
}

export interface StudentProgress {
  currentLevel: CefrLevel | null;
  completedSessions: number;
  groups: GroupProgress[];
  grades: GradedAssignmentRow[];
}

export async function getStudentProgress(studentId: string): Promise<StudentProgress> {
  const supabase = await createServerSupabaseClient();

  const [profileResult, enrollmentsResult, attendanceResult, gradesResult] =
    await Promise.all([
      supabase
        .from("student_profiles")
        .select("current_level")
        .eq("profile_id", studentId)
        .maybeSingle(),
      supabase
        .from("enrollments")
        .select("group:group_id(id, name)")
        .eq("student_id", studentId)
        .eq("status", "active"),
      supabase
        .from("attendance")
        .select("status, session:session_id(status)")
        .eq("student_id", studentId),
      supabase
        .from("assignment_submissions")
        .select(
          "score, feedback, graded_at, assignment:assignment_id(title, max_score, group:group_id(name))",
        )
        .eq("student_id", studentId)
        .eq("status", "graded")
        .order("graded_at", { ascending: false }),
    ]);

  const completedSessions = (attendanceResult.data ?? []).filter(
    (a) => a.session?.status === "completed" && a.status === "present",
  ).length;

  const groupRows = (enrollmentsResult.data ?? []).filter((row) => row.group);
  const groups: GroupProgress[] = await Promise.all(
    groupRows.map(async (row) => {
      const { data: rate } = await supabase.rpc("student_attendance_rate", {
        p_group: row.group!.id,
        p_student: studentId,
      });
      return {
        groupId: row.group!.id,
        groupName: row.group!.name,
        attendanceRate: rate ?? 0,
      };
    }),
  );

  const grades: GradedAssignmentRow[] = (gradesResult.data ?? []).map((g) => ({
    title: g.assignment?.title ?? "—",
    groupName: g.assignment?.group?.name ?? "—",
    score: g.score,
    maxScore: g.assignment?.max_score ?? null,
    gradedAt: g.graded_at,
  }));

  return {
    currentLevel: profileResult.data?.current_level ?? null,
    completedSessions,
    groups,
    grades,
  };
}
