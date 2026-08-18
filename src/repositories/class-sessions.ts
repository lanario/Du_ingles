import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SessionStatus } from "@/types/domain";

export interface SessionListItem {
  id: string;
  groupId: string;
  groupName: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  status: SessionStatus;
}

/**
 * Mesma query serve professor e aluno — a RLS já filtra por quem pergunta
 * (`class_sessions_select_teacher` vs `class_sessions_select_student`), sem
 * precisar de dois caminhos de código.
 */
export async function listMyUpcomingSessions(limit = 10): Promise<SessionListItem[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("class_sessions")
    .select(
      "id, group_id, title, scheduled_at, duration_minutes, status, group:group_id(name)",
    )
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    groupId: row.group_id,
    groupName: row.group?.name ?? "—",
    title: row.title,
    scheduledAt: row.scheduled_at,
    durationMinutes: row.duration_minutes,
    status: row.status,
  }));
}

export async function listGroupSessions(groupId: string): Promise<SessionListItem[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("class_sessions")
    .select(
      "id, group_id, title, scheduled_at, duration_minutes, status, group:group_id(name)",
    )
    .eq("group_id", groupId)
    .order("scheduled_at", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    groupId: row.group_id,
    groupName: row.group?.name ?? "—",
    title: row.title,
    scheduledAt: row.scheduled_at,
    durationMinutes: row.duration_minutes,
    status: row.status,
  }));
}
