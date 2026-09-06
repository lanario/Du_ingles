import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Recipient } from "@/lib/notifications/dispatch";

/**
 * Quem recebe o quê.
 *
 * As consultas usam service-role porque quem chama já se autorizou na action
 * (o professor confirmou a posse da turma, o admin confirmou a escola) e o
 * destinatário quase nunca é quem está logado — o RLS de `profiles` recorta
 * pelo leitor, e aqui o leitor não é o interessado.
 *
 * Todo resolvedor devolve apenas gente que ainda pode entrar no sistema:
 * conta desativada ou excluída não recebe aviso que nunca vai ler.
 */

const ACTIVE_COLUMNS = "id, role, full_name";

/** Perfis ativos entre os ids pedidos, na forma que o `dispatch` consome. */
export async function resolveRecipients(
  ids: ReadonlyArray<string | null | undefined>,
): Promise<Recipient[]> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return [];

  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("profiles")
    .select(ACTIVE_COLUMNS)
    .in("id", unique)
    .eq("is_active", true)
    .is("deleted_at", null);

  return (data ?? []).map((row) => ({
    id: row.id,
    role: row.role,
    name: row.full_name,
  }));
}

/** Alunos com matrícula ativa na turma. */
export async function groupStudents(groupId: string): Promise<Recipient[]> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("enrollments")
    .select("student_id")
    .eq("group_id", groupId)
    .eq("status", "active");

  return resolveRecipients((data ?? []).map((row) => row.student_id));
}

/** Alunos ativos de várias turmas de uma vez, sem repetir quem está em duas. */
export async function studentsOfGroups(
  groupIds: readonly string[],
): Promise<Map<string, Recipient[]>> {
  const result = new Map<string, Recipient[]>();
  if (groupIds.length === 0) return result;

  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("enrollments")
    .select("group_id, student_id")
    .in("group_id", [...groupIds])
    .eq("status", "active");

  const rows = data ?? [];
  const byId = new Map(
    (await resolveRecipients(rows.map((row) => row.student_id))).map((r) => [r.id, r]),
  );

  for (const row of rows) {
    const recipient = byId.get(row.student_id);
    if (!recipient) continue;
    const list = result.get(row.group_id);
    if (list) list.push(recipient);
    else result.set(row.group_id, [recipient]);
  }
  return result;
}

export interface GroupRef {
  id: string;
  name: string;
  teacherId: string;
}

export async function groupRef(groupId: string): Promise<GroupRef | null> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("groups")
    .select("id, name, teacher_id")
    .eq("id", groupId)
    .maybeSingle();

  return data ? { id: data.id, name: data.name, teacherId: data.teacher_id } : null;
}

/** Várias turmas de uma vez — evita um round-trip por turma no envio em lote. */
export async function groupRefs(
  groupIds: readonly string[],
): Promise<Map<string, GroupRef>> {
  const unique = [...new Set(groupIds)];
  if (unique.length === 0) return new Map();

  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("groups")
    .select("id, name, teacher_id")
    .in("id", unique);

  return new Map(
    (data ?? []).map((row) => [
      row.id,
      { id: row.id, name: row.name, teacherId: row.teacher_id },
    ]),
  );
}

/** Professor responsável pela turma. */
export async function groupTeacher(groupId: string): Promise<Recipient | null> {
  const group = await groupRef(groupId);
  if (!group) return null;
  const [teacher] = await resolveRecipients([group.teacherId]);
  return teacher ?? null;
}

/** Coordenação da escola — o público padrão de tudo que precisa de arbitragem. */
export async function orgAdmins(organizationId: string): Promise<Recipient[]> {
  return orgMembers(organizationId, "admin");
}

/** Todo mundo da escola (ou só um papel) — público do comunicado geral. */
export async function orgMembers(
  organizationId: string,
  role?: "admin" | "teacher" | "student",
): Promise<Recipient[]> {
  const admin = createAdminSupabaseClient();
  let query = admin
    .from("profiles")
    .select(ACTIVE_COLUMNS)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .is("deleted_at", null);

  if (role) query = query.eq("role", role);

  const { data } = await query;
  return (data ?? []).map((row) => ({
    id: row.id,
    role: row.role,
    name: row.full_name,
  }));
}

/**
 * Participantes do chat que não silenciaram a conversa. O chat tem badge
 * próprio na lista de conversas; a notificação é o aviso de quem está em
 * outra tela, então respeitar o mudo é o mínimo.
 */
export async function chatAudience(conversationId: string): Promise<Recipient[]> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("conversation_participants")
    .select("profile_id")
    .eq("conversation_id", conversationId)
    .eq("is_muted", false);

  return resolveRecipients((data ?? []).map((row) => row.profile_id));
}

export interface SessionRef {
  id: string;
  title: string;
  groupId: string;
  teacherId: string;
  scheduledAt: string;
}

export async function sessionRef(sessionId: string): Promise<SessionRef | null> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("class_sessions")
    .select("id, title, group_id, teacher_id, scheduled_at")
    .eq("id", sessionId)
    .maybeSingle();

  return data
    ? {
        id: data.id,
        title: data.title,
        groupId: data.group_id,
        teacherId: data.teacher_id,
        scheduledAt: data.scheduled_at,
      }
    : null;
}
