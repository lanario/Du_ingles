import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  projectSessions,
  suggestNextSlot,
  type ProjectedSession,
  type SchedulePattern,
} from "@/lib/schedule/session-preview";
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

// ------------------------------------------------------------- prévia ------

/**
 * Aula que a grade prevê mas que ninguém marcou ainda. Não tem `id` porque
 * não existe no banco: é cálculo, e some se a grade da turma mudar.
 */
export interface SessionPreviewItem extends ProjectedSession {
  groupId: string;
  groupName: string;
  title: string;
}

interface GroupSchedule {
  id: string;
  name: string;
  schedule: SchedulePattern[];
  startDate: string | null;
  endDate: string | null;
}

/**
 * Grades das turmas que quem pergunta enxerga. A RLS de `groups` já faz o
 * recorte (`groups_select_student` pelas matrículas, `groups_select_teacher`
 * pelo titular), então a mesma query serve aluno e professor.
 */
async function listVisibleGroupSchedules(): Promise<GroupSchedule[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, schedule, start_date, end_date")
    .eq("is_active", true);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    schedule: (row.schedule as SchedulePattern[] | null) ?? [],
    startDate: row.start_date,
    endDate: row.end_date,
  }));
}

/**
 * Prévia do mês de quem está logado — as datas que a grade desenha depois da
 * próxima aula já marcada. `alreadyScheduled` são os horários que já viraram
 * sessão de verdade e por isso não aparecem duas vezes.
 */
export async function listMySessionPreview(
  limit = 8,
  alreadyScheduled: string[] = [],
): Promise<SessionPreviewItem[]> {
  const groups = await listVisibleGroupSchedules();

  const projected = groups.flatMap((group) =>
    projectSessions({
      schedule: group.schedule,
      startDate: group.startDate,
      endDate: group.endDate,
      exclude: alreadyScheduled,
      keyPrefix: group.id,
      limit,
    }).map((item) => ({
      ...item,
      groupId: group.id,
      groupName: group.name,
      title: group.name,
    })),
  );

  return projected
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    .slice(0, limit);
}

/**
 * O que oferecer ao professor que acabou de encerrar a aula: a próxima já
 * marcada (se o cron ou ele mesmo já resolveu) e a sugestão de data para a
 * seguinte, tirada da grade da turma.
 *
 * Usa service-role porque é chamada de telas que JÁ confirmaram o dono da
 * sessão — a autorização mora lá, não aqui.
 */
export interface NextSessionPlan {
  groupId: string;
  groupName: string;
  /** Aula futura da turma que já existe — quando existe, não há o que marcar. */
  alreadyScheduled: { id: string; scheduledAt: string } | null;
  suggestion: { scheduledAt: string; durationMinutes: number; title: string };
}

export async function getNextSessionPlan(
  sessionId: string,
): Promise<NextSessionPlan | null> {
  const admin = createAdminSupabaseClient();

  const { data: session } = await admin
    .from("class_sessions")
    .select(
      "id, group_id, title, scheduled_at, duration_minutes, group:group_id(name, schedule, start_date, end_date)",
    )
    .eq("id", sessionId)
    .single();

  if (!session) return null;

  const group = session.group as unknown as {
    name: string;
    schedule: SchedulePattern[] | null;
    start_date: string | null;
    end_date: string | null;
  } | null;

  const { data: future } = await admin
    .from("class_sessions")
    .select("id, scheduled_at")
    .eq("group_id", session.group_id)
    .in("status", ["scheduled", "in_progress"])
    .gt("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(1);

  // Qualquer horário já ocupado da turma sai da sugestão — inclusive o das
  // aulas dadas, para não propor remarcar em cima do histórico.
  const { data: taken } = await admin
    .from("class_sessions")
    .select("scheduled_at")
    .eq("group_id", session.group_id)
    .gte("scheduled_at", session.scheduled_at);

  const slot = suggestNextSlot({
    schedule: group?.schedule ?? [],
    startDate: group?.start_date,
    endDate: group?.end_date,
    after: new Date(session.scheduled_at),
    durationMinutes: session.duration_minutes,
    exclude: (taken ?? []).map((row) => row.scheduled_at),
  });

  return {
    groupId: session.group_id,
    groupName: group?.name ?? "—",
    alreadyScheduled: future?.[0]
      ? { id: future[0].id, scheduledAt: future[0].scheduled_at }
      : null,
    suggestion: { ...slot, title: session.title },
  };
}
