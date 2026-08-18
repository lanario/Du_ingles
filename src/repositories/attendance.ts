import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AttendanceStatus } from "@/types/domain";

export interface AttendanceRow {
  studentId: string;
  studentName: string;
  status: AttendanceStatus | null;
}

/** Uma linha por aluno matriculado, com o status de presença já lançado (ou null). */
export async function listSessionAttendance(
  sessionId: string,
  groupId: string,
): Promise<AttendanceRow[]> {
  const supabase = await createServerSupabaseClient();

  const [{ data: enrollments }, { data: attendance }] = await Promise.all([
    supabase
      .from("enrollments")
      .select("student:student_id(id, full_name)")
      .eq("group_id", groupId)
      .eq("status", "active"),
    supabase.from("attendance").select("student_id, status").eq("session_id", sessionId),
  ]);

  const statusByStudent = new Map(
    (attendance ?? []).map((a) => [a.student_id, a.status]),
  );

  return (enrollments ?? [])
    .filter((e) => e.student)
    .map((e) => ({
      studentId: e.student!.id,
      studentName: e.student!.full_name,
      status: statusByStudent.get(e.student!.id) ?? null,
    }));
}

export async function recordAttendance(
  sessionId: string,
  organizationId: string,
  recordedBy: string,
  entries: { studentId: string; status: AttendanceStatus }[],
): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("attendance").upsert(
    entries.map((e) => ({
      organization_id: organizationId,
      session_id: sessionId,
      student_id: e.studentId,
      status: e.status,
      recorded_by: recordedBy,
    })),
    { onConflict: "session_id,student_id" },
  );
  return !error;
}
