import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface LibraryEntry {
  id: string;
  groupId: string;
  groupName: string;
  title: string;
  scheduledAt: string;
  hasPdf: boolean;
  /** Link externo da gravação (Meet/Drive), quando o professor já colou um. */
  recordingUrl: string | null;
}

/**
 * Data de entrada do aluno em cada turma. Um aluno pode ter mais de uma
 * matrícula na mesma turma ao longo do tempo (saiu e voltou); vale a mais
 * antiga — quem voltou para a turma não perde o material do primeiro período.
 */
async function enrollmentStartByGroup(studentId: string): Promise<Map<string, number>> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("enrollments")
    .select("group_id, enrolled_at")
    .eq("student_id", studentId);

  // Milissegundos, não a string ISO: o Postgres devolve `timestamptz` já
  // normalizado em UTC, mas comparar datas como texto é uma armadilha que só
  // aparece no dia em que o formato mudar.
  const start = new Map<string, number>();
  for (const row of data ?? []) {
    const at = new Date(row.enrolled_at).getTime();
    const current = start.get(row.group_id);
    if (current === undefined || at < current) start.set(row.group_id, at);
  }
  return start;
}

/**
 * RLS já resolve quem vê o quê: aluno só sessões publicadas das turmas em
 * que está matriculado; professor, as próprias. Um único caminho de
 * código serve os dois — mesma ideia de `listMyUpcomingSessions`.
 *
 * O que a RLS *não* sabe é **quando** o aluno entrou na turma: a política
 * (`enrolled_in_group`) libera a turma inteira, então quem se matricula no
 * meio do curso recebia de uma vez o material de todas as aulas anteriores,
 * inclusive as que nunca assistiu. `studentId` fecha esse recorte — a
 * biblioteca passa a ser só o que o aluno teve: aula concluída e realizada
 * depois da matrícula dele naquela turma.
 *
 * Faltar à aula não tira o material da estante: quem faltou é justamente
 * quem mais precisa do PDF. O corte é por matrícula, nunca por presença.
 */
export async function listLibraryEntries(
  groupId?: string,
  studentId?: string,
): Promise<LibraryEntry[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("class_sessions")
    .select("id, group_id, title, scheduled_at, pdf_path, recording_url, group:group_id(name)")
    .eq("is_published", true)
    // Aula que aconteceu de verdade. `is_published` só é ligado por
    // `endSession()`, que grava `completed` no mesmo update — o filtro é a
    // garantia de que uma aula cancelada depois de encerrada não reapareça.
    .eq("status", "completed")
    .order("scheduled_at", { ascending: false });

  if (groupId) query = query.eq("group_id", groupId);

  const [{ data, error }, enrolledSince] = await Promise.all([
    query,
    studentId ? enrollmentStartByGroup(studentId) : Promise.resolve(null),
  ]);
  if (error || !data) return [];

  return data
    .filter((row) => {
      if (!enrolledSince) return true;
      const since = enrolledSince.get(row.group_id);
      if (since === undefined) return false;
      return new Date(row.scheduled_at).getTime() >= since;
    })
    .map((row) => ({
      id: row.id,
      groupId: row.group_id,
      groupName: row.group?.name ?? "—",
      title: row.title,
      scheduledAt: row.scheduled_at,
      hasPdf: !!row.pdf_path,
      recordingUrl: row.recording_url,
    }));
}

export async function listMyGroupsForFilter(): Promise<{ id: string; name: string }[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("groups").select("id, name").order("name");
  return data ?? [];
}
