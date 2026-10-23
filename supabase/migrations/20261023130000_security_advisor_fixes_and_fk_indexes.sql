-- Event trigger que habilita RLS em tabelas novas: não precisa ser chamável via /rpc.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

alter function public.user_invites_touch_updated_at() set search_path = '';

-- Índices de cobertura para chaves estrangeiras (advisor 0001).
create index if not exists courses_organization_id_idx on public.courses (organization_id);
create index if not exists groups_course_id_idx on public.groups (course_id);
create index if not exists groups_teacher_id_idx on public.groups (teacher_id);
create index if not exists lesson_plans_author_id_idx on public.lesson_plans (author_id);
create index if not exists lesson_plans_course_id_idx on public.lesson_plans (course_id);
create index if not exists class_sessions_lesson_plan_id_idx on public.class_sessions (lesson_plan_id);
create index if not exists session_content_versions_created_by_idx on public.session_content_versions (created_by);
create index if not exists attendance_organization_id_idx on public.attendance (organization_id);
create index if not exists attendance_recorded_by_idx on public.attendance (recorded_by);
create index if not exists conversations_created_by_idx on public.conversations (created_by);
create index if not exists messages_organization_id_idx on public.messages (organization_id);
create index if not exists messages_sender_id_idx on public.messages (sender_id);
create index if not exists notifications_organization_id_idx on public.notifications (organization_id);
create index if not exists assignments_organization_id_idx on public.assignments (organization_id);
create index if not exists assignments_session_id_idx on public.assignments (session_id);
create index if not exists assignments_created_by_idx on public.assignments (created_by);
create index if not exists assignment_submissions_organization_id_idx on public.assignment_submissions (organization_id);
create index if not exists assignment_submissions_graded_by_idx on public.assignment_submissions (graded_by);
create index if not exists finance_entries_created_by_idx on public.finance_entries (created_by);
create index if not exists student_plans_created_by_idx on public.student_plans (created_by);
create index if not exists student_subscriptions_plan_id_idx on public.student_subscriptions (plan_id);
create index if not exists user_invites_created_by_idx on public.user_invites (created_by);
create index if not exists user_invites_accepted_profile_id_idx on public.user_invites (accepted_profile_id);
create index if not exists conversations_posting_changed_by_idx on public.conversations (posting_changed_by);
create index if not exists agenda_events_owner_id_idx on public.agenda_events (owner_id);
create index if not exists agenda_events_created_by_idx on public.agenda_events (created_by);
create index if not exists assignment_templates_owner_id_idx on public.assignment_templates (owner_id);
create index if not exists learning_objectives_organization_id_idx on public.learning_objectives (organization_id);
create index if not exists learning_objectives_completed_by_idx on public.learning_objectives (completed_by);
create index if not exists learning_objectives_created_by_idx on public.learning_objectives (created_by);
create index if not exists google_connections_organization_id_idx on public.google_connections (organization_id);
create index if not exists session_meet_links_host_profile_id_idx on public.session_meet_links (host_profile_id);
create index if not exists consent_records_organization_id_idx on public.consent_records (organization_id);
create index if not exists lgpd_requests_handled_by_idx on public.lgpd_requests (handled_by);
create index if not exists student_registrations_requested_plan_id_idx on public.student_registrations (requested_plan_id);
