import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { AppRole } from "@/types/domain";

/** Quanto antes da aula o aluno passa a ver o link do Meet. */
export const MEET_OPENS_MINUTES_BEFORE = 30;

export interface MeetViewer {
  id: string;
  role: AppRole;
}

export interface MeetSession {
  id: string;
  scheduledAt: string;
  status: string;
  teacherId: string;
}

/** Instante em que o link abre para o aluno. */
export function meetOpensAt(scheduledAt: string): Date {
  return new Date(new Date(scheduledAt).getTime() - MEET_OPENS_MINUTES_BEFORE * 60_000);
}

/**
 * Quem pode ver o link do Meet de uma aula, e quando.
 *
 * - admin: sempre;
 * - professor: só das aulas dele, desde a criação;
 * - aluno: só a partir de 30 min antes do horário, e nunca de aula cancelada.
 *
 * "Aluno matriculado" NÃO é conferido aqui: quem chama já recorta as aulas
 * pelas turmas do aluno (a agenda e o painel filtram por matrícula ativa).
 * Esta função existe para o servidor decidir; o cliente nunca recebe o link
 * antes da hora.
 */
export function canSeeMeet(
  viewer: MeetViewer,
  session: MeetSession,
  now = new Date(),
): boolean {
  if (session.status === "cancelled") return false;
  if (viewer.role === "admin") return true;
  if (viewer.role === "teacher") return session.teacherId === viewer.id;
  return now.getTime() >= meetOpensAt(session.scheduledAt).getTime();
}

/**
 * Links liberados para o visitante, por id de aula. Uma consulta só, por
 * service-role (a tabela não é legível pelo cliente comum). Aula sem link, ou
 * ainda fora da janela, simplesmente não aparece no mapa.
 */
export async function meetUrlsFor(
  viewer: MeetViewer,
  sessions: readonly MeetSession[],
): Promise<Map<string, string>> {
  const allowed = sessions.filter((session) => canSeeMeet(viewer, session));
  const result = new Map<string, string>();
  if (allowed.length === 0) return result;

  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("session_meet_links")
    .select("session_id, meet_url")
    .in(
      "session_id",
      allowed.map((session) => session.id),
    );

  for (const row of data ?? []) result.set(row.session_id, row.meet_url);
  return result;
}
