import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { CefrLevel } from "@/types/domain";

export interface GroupAttendanceReport {
  groupId: string;
  groupName: string;
  teacherName: string;
  attendanceRate: number | null;
  assignmentCompletionRate: number | null;
}

export interface StudentRiskRow {
  studentId: string;
  studentName: string;
  groupName: string;
  attendanceRate: number;
}

export interface TeacherSessionsReport {
  teacherId: string;
  teacherName: string;
  sessionsCompleted: number;
  totalMinutes: number;
}

export interface LevelDistributionRow {
  level: CefrLevel;
  count: number;
}

export interface AdminReport {
  groups: GroupAttendanceReport[];
  studentsAtRisk: StudentRiskRow[];
  teacherSessions: TeacherSessionsReport[];
  levelDistribution: LevelDistributionRow[];
}

/**
 * Frequência é calculada aqui em memória (uma query só) em vez de chamar
 * `student_attendance_rate()` por aluno — evita N+1 numa página que já
 * agrega a organização inteira. A fórmula replica exatamente a da função
 * (present+late / total de sessões `completed`).
 */
export async function getAdminReport(): Promise<AdminReport> {
  const supabase = await createServerSupabaseClient();

  const [
    { data: groups },
    { data: attendanceRows },
    { data: sessionRows },
    { data: profiles },
  ] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name, teacher:teacher_id(full_name)")
      .eq("is_active", true),
    supabase
      .from("attendance")
      .select(
        "status, student:student_id(id, full_name), session:session_id(status, group_id)",
      ),
    supabase
      .from("class_sessions")
      .select("teacher_id, duration_minutes, teacher:teacher_id(full_name)")
      .eq("status", "completed"),
    supabase.from("student_profiles").select("current_level"),
  ]);

  interface Bucket {
    present: number;
    total: number;
    studentName: string;
  }
  const byGroupStudent = new Map<string, Map<string, Bucket>>();
  for (const row of attendanceRows ?? []) {
    if (!row.session || row.session.status !== "completed" || !row.student) continue;
    const groupId = row.session.group_id;
    if (!byGroupStudent.has(groupId)) byGroupStudent.set(groupId, new Map());
    const studentMap = byGroupStudent.get(groupId)!;
    const bucket = studentMap.get(row.student.id) ?? {
      present: 0,
      total: 0,
      studentName: row.student.full_name,
    };
    bucket.total += 1;
    if (row.status === "present" || row.status === "late") bucket.present += 1;
    studentMap.set(row.student.id, bucket);
  }

  const studentsAtRisk: StudentRiskRow[] = [];

  const groupReports = await Promise.all(
    (groups ?? []).map(async (g) => {
      const studentMap = byGroupStudent.get(g.id);
      let attendanceRate: number | null = null;

      if (studentMap && studentMap.size > 0) {
        let sum = 0;
        for (const [studentId, bucket] of studentMap) {
          const rate = bucket.total > 0 ? (100 * bucket.present) / bucket.total : 0;
          sum += rate;
          if (rate < 75) {
            studentsAtRisk.push({
              studentId,
              studentName: bucket.studentName,
              groupName: g.name,
              attendanceRate: Math.round(rate * 10) / 10,
            });
          }
        }
        attendanceRate = Math.round((sum / studentMap.size) * 10) / 10;
      }

      const { data: completionRate } = await supabase.rpc(
        "group_assignment_completion_rate",
        { p_group: g.id },
      );

      return {
        groupId: g.id,
        groupName: g.name,
        teacherName: g.teacher?.full_name ?? "—",
        attendanceRate,
        assignmentCompletionRate: completionRate ?? null,
      };
    }),
  );

  const teacherMap = new Map<string, TeacherSessionsReport>();
  for (const s of sessionRows ?? []) {
    const entry = teacherMap.get(s.teacher_id) ?? {
      teacherId: s.teacher_id,
      teacherName: s.teacher?.full_name ?? "—",
      sessionsCompleted: 0,
      totalMinutes: 0,
    };
    entry.sessionsCompleted += 1;
    entry.totalMinutes += s.duration_minutes ?? 0;
    teacherMap.set(s.teacher_id, entry);
  }

  const levelCounts = new Map<CefrLevel, number>();
  for (const p of profiles ?? []) {
    levelCounts.set(p.current_level, (levelCounts.get(p.current_level) ?? 0) + 1);
  }

  return {
    groups: groupReports,
    studentsAtRisk: studentsAtRisk.sort((a, b) => a.attendanceRate - b.attendanceRate),
    teacherSessions: Array.from(teacherMap.values()).sort(
      (a, b) => b.sessionsCompleted - a.sessionsCompleted,
    ),
    levelDistribution: Array.from(levelCounts, ([level, count]) => ({ level, count })),
  };
}
