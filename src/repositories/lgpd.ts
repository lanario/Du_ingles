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
 *
 * Fora do export, à espera de decisão (plano LGPD §6.3 e L-05):
 * `student_profiles.notes` e as `teacher_notes` sobre o aluno. São dado
 * pessoal dele; ficar de fora exige fundamentar o art. 19 §1, e não pode
 * acontecer por esquecimento. `finance_entries` não tem vínculo com o aluno
 * (só `counterparty` em texto livre) e por isso também não entra.
 */
export async function exportOwnData(
  ctx: SessionContext,
): Promise<Record<string, unknown>> {
  const supabase = await createServerSupabaseClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, phone, birth_date, cpf, avatar_url, role, last_seen_at, created_at",
    )
    .eq("id", ctx.userId)
    .single();

  const data: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    profile,
  };

  if (ctx.realRole === "student") {
    const admin = createAdminSupabaseClient();
    const [
      studentProfile,
      enrollments,
      attendance,
      submissions,
      objectives,
      subscriptions,
      registration,
    ] = await Promise.all([
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
      // Objetivos e assinaturas: leitura por service-role com `student_id` da
      // sessão — as policies dessas tabelas foram desenhadas para as telas, não
      // para o dossiê, e o export não pode depender delas para estar completo.
      admin
        .from("learning_objectives")
        .select("title, description, is_completed, completed_at, created_at")
        .eq("student_id", ctx.userId),
      admin
        .from("student_subscriptions")
        .select(
          "status, amount_cents, currency, current_period_start, current_period_end, cancel_at_period_end, canceled_at, created_at, plan:plan_id(name)",
        )
        .eq("student_id", ctx.userId),
      admin
        .from("student_registrations")
        .select("answers, requested_plan_id, submitted_at")
        .eq("profile_id", ctx.userId)
        .maybeSingle(),
    ]);
    data.studentProfile = studentProfile.data;
    data.enrollments = enrollments.data;
    data.attendance = attendance.data;
    data.assignmentSubmissions = submissions.data;
    data.learningObjectives = objectives.data;
    data.subscriptions = subscriptions.data;
    data.studentRegistration = registration.data;
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

  // Tudo abaixo é de qualquer papel. As leituras por service-role filtram
  // pelo `ctx.userId` da sessão — nunca por input — e não trazem segredo:
  // da conexão Google sai só escopo e data, nunca o token cifrado.
  const admin = createAdminSupabaseClient();
  const [sentMessages, notifications, accessLog, consents, googleConnection, agenda] =
    await Promise.all([
      supabase
        .from("messages")
        .select("body, created_at")
        .eq("sender_id", ctx.userId)
        .is("deleted_at", null),
      admin
        .from("notifications")
        .select("type, title, body, read_at, created_at")
        .eq("recipient_id", ctx.userId)
        .order("created_at", { ascending: false }),
      admin
        .from("audit_logs")
        .select("action, entity_type, ip_address, user_agent, created_at")
        .eq("actor_id", ctx.userId)
        .order("created_at", { ascending: false })
        .limit(1000),
      admin
        .from("consent_records")
        .select("purpose, granted, document_version, choices, created_at")
        .eq("subject_id", ctx.userId)
        .order("created_at", { ascending: false }),
      admin
        .from("google_connections")
        .select("scope, status, connected_at")
        .eq("profile_id", ctx.userId)
        .maybeSingle(),
      admin
        .from("agenda_events")
        .select("kind, title, description, location, starts_at, duration_minutes")
        .eq("owner_id", ctx.userId),
    ]);
  data.sentMessages = sentMessages.data;
  data.notifications = notifications.data;
  data.accessLog = accessLog.data;
  data.consents = consents.data;
  data.googleConnection = googleConnection.data;
  data.personalAgendaEvents = agenda.data;

  return data;
}
