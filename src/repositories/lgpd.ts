import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { SessionContext } from "@/lib/auth/session";

/**
 * Direito de acesso/portabilidade (LGPD art. 18). Reúne só os dados
 * pessoais do próprio titular — nunca dados de terceiros (ex.: mensagens
 * recebidas mostram só o que ELE escreveu, não o conteúdo de quem
 * respondeu). `class_sessions.teacher_notes` não tem SELECT liberado nem
 * para o próprio professor (migration 0015) — só o admin client alcança,
 * com `teacher_id = ctx.userId` (valor de sessão, não de input) como
 * autorização manual.
 */
export async function exportOwnData(
  ctx: SessionContext,
): Promise<Record<string, unknown>> {
  const supabase = await createServerSupabaseClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, birth_date, role, created_at")
    .eq("id", ctx.userId)
    .single();

  const data: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    profile,
  };

  if (ctx.realRole === "student") {
    const [studentProfile, enrollments, attendance, submissions] = await Promise.all([
      supabase
        .from("student_profiles")
        .select(
          "current_level, guardian_name, guardian_email, guardian_phone, goals, enrollment_date",
        )
        .eq("profile_id", ctx.userId)
        .maybeSingle(),
      supabase
        .from("enrollments")
        .select("status, enrolled_at, group:group_id(name)")
        .eq("student_id", ctx.userId),
      supabase
        .from("attendance")
        .select(
          "status, recorded_at, session:session_id(scheduled_at, group:group_id(name))",
        )
        .eq("student_id", ctx.userId),
      supabase
        .from("assignment_submissions")
        .select(
          "content, status, score, feedback, submitted_at, graded_at, assignment:assignment_id(title)",
        )
        .eq("student_id", ctx.userId),
    ]);
    data.studentProfile = studentProfile.data;
    data.enrollments = enrollments.data;
    data.attendance = attendance.data;
    data.assignmentSubmissions = submissions.data;
  }

  if (ctx.realRole === "teacher") {
    const admin = createAdminSupabaseClient();
    const [teacherProfile, lessonPlans, sessions] = await Promise.all([
      supabase
        .from("teacher_profiles")
        .select("bio, certifications, hourly_rate, is_public")
        .eq("profile_id", ctx.userId)
        .maybeSingle(),
      supabase
        .from("lesson_plans")
        .select("title, summary, level, created_at")
        .eq("author_id", ctx.userId),
      admin
        .from("class_sessions")
        .select(
          "title, scheduled_at, status, homework, teacher_notes, group:group_id(name)",
        )
        .eq("teacher_id", ctx.userId),
    ]);
    data.teacherProfile = teacherProfile.data;
    data.lessonPlans = lessonPlans.data;
    data.classSessions = sessions.data;
  }

  const { data: sentMessages } = await supabase
    .from("messages")
    .select("body, created_at")
    .eq("sender_id", ctx.userId)
    .is("deleted_at", null);
  data.sentMessages = sentMessages;

  return data;
}
