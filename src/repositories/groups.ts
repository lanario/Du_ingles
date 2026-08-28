import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { CefrLevel } from "@/types/domain";
import type { CreateGroupInput, UpdateGroupInput } from "@/schemas/groups";

export interface GroupListItem {
  id: string;
  name: string;
  level: CefrLevel;
  teacherId: string;
  teacherName: string;
  courseId: string | null;
  courseName: string | null;
  maxStudents: number;
  enrolledCount: number;
  isActive: boolean;
}

export interface GroupDetail extends GroupListItem {
  schedule: { weekday: number; start: string; end: string }[];
  startDate: string | null;
  endDate: string | null;
}

/**
 * Lista com contagem de matrículas numa única query (join + count) — nunca
 * uma query por turma (§10.1, zero N+1).
 */
export async function listGroups(): Promise<GroupListItem[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("groups")
    .select(
      "id, name, level, max_students, is_active, course_id, teacher:teacher_id(id, full_name), course:course_id(name), enrollments(count)",
    )
    .eq("enrollments.status", "active")
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    level: row.level,
    teacherId: row.teacher?.id ?? "",
    teacherName: row.teacher?.full_name ?? "—",
    courseId: row.course_id,
    courseName: row.course?.name ?? null,
    maxStudents: row.max_students,
    enrolledCount: row.enrollments?.[0]?.count ?? 0,
    isActive: row.is_active,
  }));
}

/** Projeção completa usada pelas telas de Turmas da área logada. */
const GROUP_SELECT =
  "id, name, level, max_students, is_active, course_id, schedule, start_date, end_date, teacher:teacher_id(id, full_name), course:course_id(name), enrollments(count)";

interface GroupRow {
  id: string;
  name: string;
  level: CefrLevel;
  max_students: number;
  is_active: boolean;
  course_id: string | null;
  schedule: unknown;
  start_date: string | null;
  end_date: string | null;
  teacher: { id: string; full_name: string } | null;
  course: { name: string } | null;
  enrollments: { count: number }[] | null;
}

function mapGroupRow(row: GroupRow): GroupDetail {
  return {
    id: row.id,
    name: row.name,
    level: row.level,
    teacherId: row.teacher?.id ?? "",
    teacherName: row.teacher?.full_name ?? "—",
    courseId: row.course_id,
    courseName: row.course?.name ?? null,
    maxStudents: row.max_students,
    enrolledCount: row.enrollments?.[0]?.count ?? 0,
    isActive: row.is_active,
    schedule: (row.schedule as GroupDetail["schedule"]) ?? [],
    startDate: row.start_date,
    endDate: row.end_date,
  };
}

/** Turmas do professor logado, com horários e lotação — tela `/turmas`. */
export async function listGroupsByTeacher(teacherId: string): Promise<GroupDetail[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("groups")
    .select(GROUP_SELECT)
    .eq("teacher_id", teacherId)
    .eq("enrollments.status", "active")
    .order("is_active", { ascending: false })
    .order("name");

  if (error || !data) return [];
  return (data as unknown as GroupRow[]).map(mapGroupRow);
}

/**
 * Turmas por id, numa única query (`in`) — a tela do aluno primeiro resolve
 * as matrículas e depois hidrata as turmas em lote, nunca uma por vez.
 */
export async function listGroupsByIds(ids: string[]): Promise<GroupDetail[]> {
  if (ids.length === 0) return [];
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("groups")
    .select(GROUP_SELECT)
    .in("id", ids)
    .eq("enrollments.status", "active")
    .order("name");

  if (error || !data) return [];
  return (data as unknown as GroupRow[]).map(mapGroupRow);
}

/** Turmas ativas da organização — destino possível de uma troca. */
export async function listActiveGroups(): Promise<GroupDetail[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("groups")
    .select(GROUP_SELECT)
    .eq("is_active", true)
    .eq("enrollments.status", "active")
    .order("name");

  if (error || !data) return [];
  return (data as unknown as GroupRow[]).map(mapGroupRow);
}

/** Todas as turmas da organização, com horários e lotação — visão do admin. */
export async function listAllGroups(): Promise<GroupDetail[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("groups")
    .select(GROUP_SELECT)
    .eq("enrollments.status", "active")
    .order("is_active", { ascending: false })
    .order("name");

  if (error || !data) return [];
  return (data as unknown as GroupRow[]).map(mapGroupRow);
}

export interface MyGroupItem {
  id: string;
  name: string;
  level: CefrLevel;
}

/** Turmas do professor logado — usado nos seletores de Tarefas/Sala de aula. */
export async function listMyGroups(teacherId: string): Promise<MyGroupItem[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, level")
    .eq("teacher_id", teacherId)
    .eq("is_active", true)
    .order("name");

  if (error || !data) return [];
  return data;
}

export async function getGroupById(id: string): Promise<GroupDetail | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("groups")
    .select(
      "id, name, level, max_students, is_active, course_id, schedule, start_date, end_date, teacher:teacher_id(id, full_name), course:course_id(name), enrollments(count)",
    )
    .eq("id", id)
    .eq("enrollments.status", "active")
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.name,
    level: data.level,
    teacherId: data.teacher?.id ?? "",
    teacherName: data.teacher?.full_name ?? "—",
    courseId: data.course_id,
    courseName: data.course?.name ?? null,
    maxStudents: data.max_students,
    enrolledCount: data.enrollments?.[0]?.count ?? 0,
    isActive: data.is_active,
    schedule: (data.schedule as { weekday: number; start: string; end: string }[]) ?? [],
    startDate: data.start_date,
    endDate: data.end_date,
  };
}

export async function createGroup(
  input: CreateGroupInput,
  organizationId: string,
): Promise<{ success: boolean; groupId?: string; message?: string }> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("groups")
    .insert({
      organization_id: organizationId,
      course_id: input.courseId ?? null,
      teacher_id: input.teacherId,
      name: input.name,
      level: input.level as CefrLevel,
      max_students: input.maxStudents,
      schedule: input.schedule,
      start_date: input.startDate ?? null,
      end_date: input.endDate ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { success: false, message: "Falha ao criar a turma." };
  }

  // Gera as sessões das próximas 4 semanas imediatamente — não espera o
  // cron das 03:00 (critério de conclusão da Fase 4). É o que põe a turma na
  // agenda do professor no mesmo instante em que ela é criada, então uma
  // falha aqui não pode passar em silêncio.
  const { error: generateError } = await admin.rpc("generate_recurring_sessions", {
    p_group_id: data.id,
  });
  if (generateError) {
    console.error(
      "[groups] turma criada, mas as sessões não foram geradas:",
      generateError.message,
    );
  }

  return { success: true, groupId: data.id };
}

/**
 * Passa para o novo responsável as aulas que ainda vão acontecer.
 *
 * `class_sessions.teacher_id` é uma cópia do responsável da turma, feita na
 * geração — e é ela, não a coluna da turma, que a agenda do professor lê
 * (`/planejador` filtra as sessões por `teacherId`). Sem esta passagem de
 * bastão, reatribuir a turma deixava a agenda do novo professor vazia e as
 * aulas paradas na agenda de quem já não responde pela turma.
 *
 * O corte é o presente: o que já aconteceu fica com quem deu a aula — chamada,
 * registro e PDF apontam para aquela pessoa, e reescrever isso seria falsear
 * histórico. Aula em andamento também fica: quem abriu a sala termina.
 *
 * Devolve quantas mudaram de dono, ou `null` se a atualização falhou.
 */
async function handOverFutureSessions(
  groupId: string,
  teacherId: string,
): Promise<number | null> {
  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("class_sessions")
    .update({ teacher_id: teacherId, updated_at: now })
    .eq("group_id", groupId)
    .eq("status", "scheduled")
    .gte("scheduled_at", now)
    .neq("teacher_id", teacherId)
    .select("id");

  if (error) {
    console.error("[groups] falha ao passar as aulas futuras:", error.message);
    return null;
  }
  return data?.length ?? 0;
}

/** Turma que nunca gerou sessão nenhuma — nem futura, nem histórico. */
async function hasNoSessions(groupId: string): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { count, error } = await admin
    .from("class_sessions")
    .select("id", { count: "exact", head: true })
    .eq("group_id", groupId);
  return !error && (count ?? 0) === 0;
}

/**
 * Edição de turma. Regerar as sessões só quando a grade muda: `schedule`
 * ausente significa "não mexi nos horários", e regerar à toa apagaria/
 * recriaria sessões já vinculadas a planos de aula e presenças.
 *
 * Trocar o responsável é diferente de mudar a grade: os horários continuam os
 * mesmos, só mudam de dono. Por isso a reatribuição passa as aulas futuras
 * para o novo professor em vez de regerar a série.
 */
export async function updateGroup(input: UpdateGroupInput): Promise<{
  success: boolean;
  message?: string;
  /** Preenchido só quando o responsável mudou — alimenta o log de auditoria. */
  handover?: { previousTeacherId: string | null; sessions: number };
}> {
  const admin = createAdminSupabaseClient();

  // O responsável anterior tem que ser lido ANTES da escrita: é a comparação
  // que diz se as aulas já geradas precisam trocar de dono.
  const { data: before } = await admin
    .from("groups")
    .select("teacher_id")
    .eq("id", input.id)
    .maybeSingle();

  const { error } = await admin
    .from("groups")
    .update({
      name: input.name,
      level: input.level as CefrLevel,
      max_students: input.maxStudents,
      course_id: input.courseId ?? null,
      start_date: input.startDate ?? null,
      end_date: input.endDate ?? null,
      is_active: input.isActive,
      updated_at: new Date().toISOString(),
      ...(input.teacherId ? { teacher_id: input.teacherId } : {}),
      ...(input.schedule ? { schedule: input.schedule } : {}),
    })
    .eq("id", input.id);
  if (error) return { success: false, message: "Falha ao salvar a turma." };

  if (input.schedule) {
    await admin.rpc("generate_recurring_sessions", { p_group_id: input.id });
  }

  const changedTeacher =
    Boolean(input.teacherId) && before?.teacher_id !== input.teacherId;
  if (!changedTeacher || !input.teacherId) return { success: true };

  const moved = await handOverFutureSessions(input.id, input.teacherId);
  if (moved === null) {
    return {
      success: false,
      message:
        "A turma foi salva, mas as aulas futuras continuam com o professor anterior. Salve novamente para concluir a passagem.",
    };
  }

  /**
   * Turma sem sessão nenhuma: a agenda do novo professor ficaria vazia mesmo
   * com a grade preenchida. Gerar aqui é seguro justamente porque não há nada
   * para sobrescrever — e a série já nasce com o novo responsável, que é o que
   * ficou gravado na turma alguns comandos acima.
   */
  if (moved === 0 && !input.schedule && (await hasNoSessions(input.id))) {
    await admin.rpc("generate_recurring_sessions", { p_group_id: input.id });
  }

  return {
    success: true,
    handover: { previousTeacherId: before?.teacher_id ?? null, sessions: moved },
  };
}

/**
 * Dono da turma. Usa service-role de proposito: a checagem de autorizacao
 * nao pode depender da RLS do proprio requisitante, senao "nao vejo a linha"
 * e "a linha nao e minha" viram o mesmo resultado.
 */
export async function isGroupOwnedByTeacher(
  groupId: string,
  teacherId: string,
): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("groups")
    .select("id")
    .eq("id", groupId)
    .eq("teacher_id", teacherId)
    .maybeSingle();
  return Boolean(data);
}

/** Professor responsavel por uma turma — destinatario do pedido de troca. */
export async function getGroupTeacherId(groupId: string): Promise<string | null> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("groups")
    .select("teacher_id")
    .eq("id", groupId)
    .maybeSingle();
  return data?.teacher_id ?? null;
}

/**
 * Arquivar/reativar uma turma. É um `update` de uma coluna só, separado de
 * `updateGroup` de propósito: alternar do cartão não pode arrastar junto a
 * regeração de sessões nem exigir o resto do formulário.
 */
export async function setGroupActive(
  groupId: string,
  isActive: boolean,
): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("groups")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", groupId);
  return !error;
}
