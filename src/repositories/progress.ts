import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { measureDataQuery } from "@/lib/observability/performance";
import { groupAttendanceRates } from "@/lib/attendance/group-rates";
import type { CefrLevel } from "@/types/domain";

export interface GroupProgress {
  groupId: string;
  groupName: string;
  level: CefrLevel | null;
  teacherName: string;
  attendanceRate: number;
  nextSessionAt: string | null;
}

export interface GradedAssignmentRow {
  title: string;
  groupName: string;
  score: number | null;
  maxScore: number | null;
  gradedAt: string | null;
}

export interface NextSessionInfo {
  title: string;
  groupName: string;
  teacherName: string;
  scheduledAt: string;
  durationMinutes: number;
}

export interface StudentProgress {
  currentLevel: CefrLevel | null;
  enrollmentDate: string | null;
  completedSessions: number;
  overallAttendanceRate: number | null;
  /** Aulas presentes consecutivas mais recentes, contando de trás pra frente. */
  streak: number;
  groups: GroupProgress[];
  grades: GradedAssignmentRow[];
  nextSession: NextSessionInfo | null;
}

export async function getStudentProgress(studentId: string): Promise<StudentProgress> {
  const supabase = await createServerSupabaseClient();

  const [profileResult, enrollmentsResult, attendanceResult, gradesResult] =
    await Promise.all([
      measureDataQuery("studentProgress.profile", () =>
        supabase
          .from("student_profiles")
          .select("current_level, enrollment_date")
          .eq("profile_id", studentId)
          .maybeSingle(),
      ),
      measureDataQuery("studentProgress.enrollments", () =>
        supabase
          .from("enrollments")
          .select("group:group_id(id, name, level, teacher:teacher_id(full_name))")
          .eq("student_id", studentId)
          .eq("status", "active"),
      ),
      measureDataQuery("studentProgress.attendance", () =>
        supabase
          .from("attendance")
          .select("status, session:session_id(id, status, scheduled_at, group_id)")
          .eq("student_id", studentId),
      ),
      measureDataQuery("studentProgress.grades", () =>
        supabase
          .from("assignment_submissions")
          .select(
            "score, graded_at, assignment:assignment_id(title, max_score, group:group_id(name))",
          )
          .eq("student_id", studentId)
          .eq("status", "graded")
          .order("graded_at", { ascending: false }),
      ),
    ]);

  for (const [name, result] of [
    ["perfil", profileResult],
    ["matrículas", enrollmentsResult],
    ["presenças", attendanceResult],
    ["notas", gradesResult],
  ] as const) {
    if (result.error)
      throw new Error(`Falha ao carregar ${name} do progresso (${result.error.code}).`);
  }

  const attendanceRows = attendanceResult.data ?? [];
  const completedSessions = attendanceRows.filter(
    (a) => a.session?.status === "completed" && a.status === "present",
  ).length;

  // Presença geral: só sessões já concluídas contam para a taxa (uma futura
  // sem registro ainda não é falta).
  const completedAttendance = attendanceRows.filter(
    (a) => a.session?.status === "completed",
  );
  const presentCount = completedAttendance.filter(
    (a) => a.status === "present" || a.status === "late",
  ).length;
  const overallAttendanceRate =
    completedAttendance.length > 0
      ? Math.round((100 * presentCount) / completedAttendance.length)
      : null;

  // Sequência atual: da aula concluída mais recente para trás, contando
  // enquanto o aluno esteve presente (ou atrasado — ainda compareceu).
  const orderedByRecent = [...completedAttendance].sort(
    (a, b) =>
      new Date(b.session!.scheduled_at).getTime() -
      new Date(a.session!.scheduled_at).getTime(),
  );
  let streak = 0;
  for (const row of orderedByRecent) {
    if (row.status === "present" || row.status === "late") streak += 1;
    else break;
  }

  const groupRows = (enrollmentsResult.data ?? []).filter((row) => row.group);
  const groupIds = groupRows.map((row) => row.group!.id);
  const ratesByGroup = groupAttendanceRates(attendanceRows);

  interface UpcomingSessionRow {
    title: string;
    group_id: string;
    scheduled_at: string;
    duration_minutes: number;
    teacher: { full_name: string } | null;
  }

  let upcomingSessions: UpcomingSessionRow[] = [];
  if (groupIds.length) {
    const { data, error } = await measureDataQuery("studentProgress.upcoming", () =>
      supabase
        .from("class_sessions")
        .select(
          "title, group_id, scheduled_at, duration_minutes, teacher:teacher_id(full_name)",
        )
        .in("group_id", groupIds)
        .in("status", ["scheduled", "in_progress"])
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true }),
    );
    if (error) throw new Error(`Falha ao carregar aulas futuras (${error.code}).`);
    upcomingSessions = data ?? [];
  }

  const upcomingByGroup = new Map<string, UpcomingSessionRow>();
  for (const session of upcomingSessions) {
    if (!upcomingByGroup.has(session.group_id))
      upcomingByGroup.set(session.group_id, session);
  }
  const nextOverall = upcomingSessions[0] ?? null;
  const groupNameById = new Map(groupRows.map((row) => [row.group!.id, row.group!.name]));

  const groups: GroupProgress[] = groupRows.map((row) => ({
    groupId: row.group!.id,
    groupName: row.group!.name,
    level: row.group!.level,
    teacherName: row.group!.teacher?.full_name ?? "—",
    attendanceRate: ratesByGroup.get(row.group!.id) ?? 0,
    nextSessionAt: upcomingByGroup.get(row.group!.id)?.scheduled_at ?? null,
  }));

  const grades: GradedAssignmentRow[] = (gradesResult.data ?? []).map((g) => ({
    title: g.assignment?.title ?? "—",
    groupName: g.assignment?.group?.name ?? "—",
    score: g.score,
    maxScore: g.assignment?.max_score ?? null,
    gradedAt: g.graded_at,
  }));

  return {
    currentLevel: profileResult.data?.current_level ?? null,
    enrollmentDate: profileResult.data?.enrollment_date ?? null,
    completedSessions,
    overallAttendanceRate,
    streak,
    groups,
    grades,
    nextSession: nextOverall
      ? {
          title: nextOverall.title,
          groupName: groupNameById.get(nextOverall.group_id) ?? "—",
          teacherName: nextOverall.teacher?.full_name ?? "—",
          scheduledAt: nextOverall.scheduled_at,
          durationMinutes: nextOverall.duration_minutes,
        }
      : null,
  };
}
