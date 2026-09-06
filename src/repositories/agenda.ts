import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { projectSessions, type SchedulePattern } from "@/lib/schedule/session-preview";
import type { SessionContext } from "@/lib/auth/session";
import type {
  AgendaAudience,
  AgendaEventKind,
  AppRole,
  CefrLevel,
  SessionStatus,
} from "@/types/domain";
import type { AgendaEventInput } from "@/schemas/agenda";

/**
 * A agenda da escola, montada de três fontes que a tela mostra lado a lado:
 *
 *   1. `class_sessions` — a aula que existe no banco. Editável.
 *   2. a grade da turma  — as aulas que a grade ainda vai gerar (0035 guarda
 *      só a próxima). Entram como *prévia*: sem id, sem edição, e com essa
 *      cara na interface. Sem elas o mês do aluno teria uma linha só.
 *   3. `agenda_events`   — reunião, prova, evento, recesso. Editável.
 *
 * O recorte por papel acontece AQUI, não na interface: as queries usam
 * service-role (ignoram RLS), então o filtro por turma/autoria escrito abaixo
 * é a autorização de leitura de verdade. E cada item já sai do servidor
 * dizendo se quem pediu pode editá-lo — a tela não recalcula permissão, só
 * desenha o que veio.
 */

export type AgendaItemKind = "session" | "preview" | "event";

export interface AgendaGroupRef {
  id: string;
  name: string;
  level: CefrLevel;
  teacherId: string;
  teacherName: string;
  /** Índice na paleta de séries do sistema (`--chart-1`…`--chart-6`). */
  colorIndex: number;
}

export interface AgendaItem {
  /** Chave estável de lista. A prévia não tem id de banco, então precisa. */
  key: string;
  kind: AgendaItemKind;
  /** `null` na prévia — não existe linha para apontar. */
  id: string | null;
  title: string;
  /** Instante em UTC (ISO). O fuso da escola é aplicado na renderização. */
  startsAt: string;
  durationMinutes: number;
  allDay: boolean;
  groupId: string | null;
  groupName: string | null;
  teacherId: string | null;
  teacherName: string | null;
  /** Só em aula. */
  status: SessionStatus | null;
  /** Só em compromisso. */
  eventKind: AgendaEventKind | null;
  audience: AgendaAudience | null;
  location: string | null;
  description: string | null;
  canEdit: boolean;
  canDelete: boolean;
}

export interface AgendaData {
  items: AgendaItem[];
  /** Turmas que quem pediu enxerga — alimentam o filtro lateral. */
  groups: AgendaGroupRef[];
  role: AppRole;
  /** Papel efetivo pode criar compromisso? (aluno nunca). */
  canCreateEvent: boolean;
  /** Só a coordenação marca para a escola inteira (`group_id` nulo). */
  canCreateSchoolWide: boolean;
  /** Janela carregada, em ISO — a tela não navega para fora dela sem recarregar. */
  window: { from: string; to: string };
}

interface GroupRow {
  id: string;
  name: string;
  level: CefrLevel;
  teacher_id: string;
  schedule: unknown;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  teacher: { full_name: string } | null;
}

interface SessionRow {
  id: string;
  group_id: string;
  teacher_id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  status: SessionStatus;
  teacher: { full_name: string } | null;
}

interface EventRow {
  id: string;
  group_id: string | null;
  owner_id: string | null;
  created_by: string;
  kind: AgendaEventKind;
  audience: AgendaAudience;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  duration_minutes: number;
  all_day: boolean;
  owner: { full_name: string } | null;
}

const GROUP_SELECT =
  "id, name, level, teacher_id, schedule, start_date, end_date, is_active, teacher:teacher_id(full_name)";
const SESSION_SELECT =
  "id, group_id, teacher_id, title, scheduled_at, duration_minutes, status, teacher:teacher_id(full_name)";
const EVENT_SELECT =
  "id, group_id, owner_id, created_by, kind, audience, title, description, location, starts_at, duration_minutes, all_day, owner:owner_id(full_name)";

/** Janela padrão: o mês passado e os quatro meses seguintes. */
const DEFAULT_BACK_DAYS = 45;
const DEFAULT_AHEAD_DAYS = 120;

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 3600_000).toISOString();
}

/**
 * Turmas que este papel enxerga na agenda.
 *
 * O aluno resolve pelas matrículas ativas; o professor, pelas turmas em que é
 * o responsável; o admin vê a escola. Turma arquivada continua aparecendo
 * para a coordenação (o histórico dela também é agenda), mas não gera prévia
 * — a grade de uma turma encerrada não desenha aula nenhuma.
 */
async function visibleGroups(ctx: SessionContext): Promise<GroupRow[]> {
  const admin = createAdminSupabaseClient();
  const role = ctx.effectiveRole;

  if (role === "student") {
    const { data: enrollments } = await admin
      .from("enrollments")
      .select("group_id")
      .eq("student_id", ctx.userId)
      .eq("status", "active");

    const ids = (enrollments ?? []).map((row) => row.group_id);
    if (ids.length === 0) return [];

    const { data } = await admin.from("groups").select(GROUP_SELECT).in("id", ids);
    return (data ?? []) as unknown as GroupRow[];
  }

  const query = admin
    .from("groups")
    .select(GROUP_SELECT)
    .eq("organization_id", ctx.organizationId)
    .order("name");

  if (role === "teacher") query.eq("teacher_id", ctx.userId);

  const { data } = await query;
  return (data ?? []) as unknown as GroupRow[];
}

function mapGroupRefs(rows: GroupRow[]): AgendaGroupRef[] {
  return rows.map((row, index) => ({
    id: row.id,
    name: row.name,
    level: row.level,
    teacherId: row.teacher_id,
    teacherName: row.teacher?.full_name ?? "—",
    // A cor acompanha a ordem alfabética das turmas: estável entre visitas,
    // então a turma que era azul continua azul amanhã.
    colorIndex: index % 6,
  }));
}

/**
 * O professor também é dono das aulas que ele dá em turma que não é dele
 * (substituição): `class_sessions.teacher_id` é o corte, não a turma.
 */
async function listSessions(
  ctx: SessionContext,
  groupIds: string[],
  from: string,
  to: string,
): Promise<SessionRow[]> {
  const admin = createAdminSupabaseClient();
  const role = ctx.effectiveRole;

  const base = () =>
    admin
      .from("class_sessions")
      .select(SESSION_SELECT)
      .eq("organization_id", ctx.organizationId)
      .gte("scheduled_at", from)
      .lte("scheduled_at", to)
      .order("scheduled_at", { ascending: true })
      .limit(1000);

  if (role === "admin") {
    const { data } = await base();
    return (data ?? []) as unknown as SessionRow[];
  }

  if (role === "teacher") {
    // Duas queries em vez de um `or` com lista embutida: a sintaxe `or=(...)`
    // do PostgREST não aceita `in` com uuid sem escapar cada item, e uma
    // string montada à mão é exatamente onde um id vira injeção de filtro.
    const [own, byGroup] = await Promise.all([
      base().eq("teacher_id", ctx.userId),
      groupIds.length > 0 ? base().in("group_id", groupIds) : Promise.resolve({ data: [] }),
    ]);
    const merged = new Map<string, SessionRow>();
    for (const row of [
      ...((own.data ?? []) as unknown as SessionRow[]),
      ...((byGroup.data ?? []) as unknown as SessionRow[]),
    ]) {
      merged.set(row.id, row);
    }
    return [...merged.values()];
  }

  if (groupIds.length === 0) return [];
  // O aluno não vê aula cancelada: para ele o compromisso deixou de existir,
  // e um cartão riscado no calendário só gera dúvida sobre se tem aula.
  const { data } = await base().in("group_id", groupIds).neq("status", "cancelled");
  return (data ?? []) as unknown as SessionRow[];
}

async function listEvents(
  ctx: SessionContext,
  groupIds: string[],
  from: string,
  to: string,
): Promise<EventRow[]> {
  const admin = createAdminSupabaseClient();
  const role = ctx.effectiveRole;

  const base = () =>
    admin
      .from("agenda_events")
      .select(EVENT_SELECT)
      .eq("organization_id", ctx.organizationId)
      .gte("starts_at", from)
      .lte("starts_at", to)
      .order("starts_at", { ascending: true })
      .limit(500);

  if (role === "admin") {
    const { data } = await base();
    return (data ?? []) as unknown as EventRow[];
  }

  // Compromisso da escola inteira (`group_id` nulo) alcança todo mundo; o de
  // turma, só quem está nela. `audience` é o segundo corte: reunião de
  // coordenação não é assunto de aluno, aviso de aluno não polui a agenda de
  // quem dá aula.
  const forbidden: AgendaAudience = role === "student" ? "staff" : "students";

  const [schoolWide, mine] = await Promise.all([
    base().is("group_id", null).neq("audience", forbidden),
    groupIds.length > 0
      ? base().in("group_id", groupIds).neq("audience", forbidden)
      : Promise.resolve({ data: [] }),
  ]);

  const merged = new Map<string, EventRow>();
  for (const row of [
    ...((schoolWide.data ?? []) as unknown as EventRow[]),
    ...((mine.data ?? []) as unknown as EventRow[]),
  ]) {
    merged.set(row.id, row);
  }
  return [...merged.values()];
}

/**
 * Aula que a grade prevê e ninguém marcou ainda. Nunca editável — não há o
 * que editar — e sempre atrás do que existe de verdade na ordenação.
 */
function buildPreviews(
  groups: GroupRow[],
  sessions: SessionRow[],
  from: string,
  to: string,
): AgendaItem[] {
  const fromDate = new Date(from);
  const days = Math.max(
    Math.ceil((new Date(to).getTime() - fromDate.getTime()) / (24 * 3600_000)),
    1,
  );

  return groups
    .filter((group) => group.is_active)
    .flatMap((group) => {
      const schedule = (group.schedule as SchedulePattern[] | null) ?? [];
      if (schedule.length === 0) return [];

      const taken = sessions
        .filter((session) => session.group_id === group.id)
        .map((session) => session.scheduled_at);

      return projectSessions({
        schedule,
        startDate: group.start_date,
        endDate: group.end_date,
        from: fromDate,
        days,
        exclude: taken,
        limit: 60,
        keyPrefix: group.id,
      }).map<AgendaItem>((projected) => ({
        key: projected.key,
        kind: "preview",
        id: null,
        title: group.name,
        startsAt: projected.scheduledAt,
        durationMinutes: projected.durationMinutes,
        allDay: false,
        groupId: group.id,
        groupName: group.name,
        teacherId: group.teacher_id,
        teacherName: group.teacher?.full_name ?? "—",
        status: null,
        eventKind: null,
        audience: null,
        location: null,
        description: null,
        canEdit: false,
        canDelete: false,
      }));
    });
}

/**
 * Aula editável: a coordenação sempre; o professor quando a aula é dele (ou
 * da turma dele). Aula já dada, em andamento ou cancelada não se remarca —
 * mexer nela seria reescrever histórico, e o repositório do planejador já
 * recusa (`status = 'scheduled'` no `where`).
 */
function sessionRights(
  ctx: SessionContext,
  row: SessionRow,
  groupIds: Set<string>,
): { canEdit: boolean; canDelete: boolean } {
  const role = ctx.effectiveRole;
  if (role === "student") return { canEdit: false, canDelete: false };

  const owns =
    role === "admin" || row.teacher_id === ctx.userId || groupIds.has(row.group_id);
  const open = row.status === "scheduled";
  return { canEdit: owns && open, canDelete: owns && open };
}

/** Compromisso: admin em tudo; professor só no que é da própria turma. */
function eventRights(
  ctx: SessionContext,
  row: EventRow,
  groupIds: Set<string>,
): { canEdit: boolean; canDelete: boolean } {
  const role = ctx.effectiveRole;
  if (role === "admin") return { canEdit: true, canDelete: true };
  if (role !== "teacher") return { canEdit: false, canDelete: false };

  const mine = row.group_id !== null && groupIds.has(row.group_id);
  return { canEdit: mine, canDelete: mine };
}

export async function getAgenda(
  ctx: SessionContext,
  options: { from?: string; to?: string } = {},
): Promise<AgendaData> {
  const from = options.from ?? isoDaysFromNow(-DEFAULT_BACK_DAYS);
  const to = options.to ?? isoDaysFromNow(DEFAULT_AHEAD_DAYS);

  const groupRows = await visibleGroups(ctx);
  const groupIds = groupRows.map((row) => row.id);
  const ownedGroupIds = new Set(groupIds);

  const [sessions, events] = await Promise.all([
    listSessions(ctx, groupIds, from, to),
    listEvents(ctx, groupIds, from, to),
  ]);

  const groups = mapGroupRefs(groupRows);
  const groupName = new Map(groups.map((group) => [group.id, group.name]));

  const sessionItems = sessions.map<AgendaItem>((row) => ({
    key: `session-${row.id}`,
    kind: "session",
    id: row.id,
    title: row.title,
    startsAt: row.scheduled_at,
    durationMinutes: row.duration_minutes,
    allDay: false,
    groupId: row.group_id,
    groupName: groupName.get(row.group_id) ?? null,
    teacherId: row.teacher_id,
    teacherName: row.teacher?.full_name ?? "—",
    status: row.status,
    eventKind: null,
    audience: null,
    location: null,
    description: null,
    ...sessionRights(ctx, row, ownedGroupIds),
  }));

  const eventItems = events.map<AgendaItem>((row) => ({
    key: `event-${row.id}`,
    kind: "event",
    id: row.id,
    title: row.title,
    startsAt: row.starts_at,
    durationMinutes: row.duration_minutes,
    allDay: row.all_day,
    groupId: row.group_id,
    groupName: row.group_id ? (groupName.get(row.group_id) ?? null) : null,
    teacherId: row.owner_id,
    teacherName: row.owner?.full_name ?? null,
    status: null,
    eventKind: row.kind,
    audience: row.audience,
    location: row.location,
    description: row.description,
    ...eventRights(ctx, row, ownedGroupIds),
  }));

  const previews = buildPreviews(groupRows, sessions, from, to);

  const items = [...sessionItems, ...eventItems, ...previews].sort((a, b) =>
    a.startsAt.localeCompare(b.startsAt),
  );

  const role = ctx.effectiveRole;
  return {
    items,
    groups,
    role,
    canCreateEvent: role === "admin" || role === "teacher",
    canCreateSchoolWide: role === "admin",
    window: { from, to },
  };
}

// ------------------------------------------------------------ escrita ------

export interface AgendaEventOwner {
  id: string;
  groupId: string | null;
  organizationId: string;
}

/** Dono do compromisso — usado pela action antes de deixar editar/apagar. */
export async function getAgendaEventOwner(id: string): Promise<AgendaEventOwner | null> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("agenda_events")
    .select("id, group_id, organization_id")
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id,
    groupId: data.group_id,
    organizationId: data.organization_id,
  };
}

export async function createAgendaEvent(input: {
  organizationId: string;
  createdBy: string;
  ownerId: string | null;
  groupId: string | null;
  data: AgendaEventInput;
  startsAt: string;
}): Promise<string | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("agenda_events")
    .insert({
      organization_id: input.organizationId,
      created_by: input.createdBy,
      owner_id: input.ownerId,
      group_id: input.groupId,
      kind: input.data.kind as AgendaEventKind,
      audience: input.data.audience as AgendaAudience,
      title: input.data.title,
      description: input.data.description ?? null,
      location: input.data.location ?? null,
      starts_at: input.startsAt,
      duration_minutes: input.data.durationMinutes,
      all_day: input.data.allDay,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[agenda] falha ao criar compromisso:", error?.message);
    return null;
  }
  return data.id;
}

export async function updateAgendaEvent(input: {
  id: string;
  organizationId: string;
  groupId: string | null;
  data: AgendaEventInput;
  startsAt: string;
}): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("agenda_events")
    .update({
      group_id: input.groupId,
      kind: input.data.kind as AgendaEventKind,
      audience: input.data.audience as AgendaAudience,
      title: input.data.title,
      description: input.data.description ?? null,
      location: input.data.location ?? null,
      starts_at: input.startsAt,
      duration_minutes: input.data.durationMinutes,
      all_day: input.data.allDay,
    })
    .eq("id", input.id)
    .eq("organization_id", input.organizationId);

  if (error) console.error("[agenda] falha ao salvar compromisso:", error.message);
  return !error;
}

export async function deleteAgendaEvent(
  id: string,
  organizationId: string,
): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("agenda_events")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (error) console.error("[agenda] falha ao excluir compromisso:", error.message);
  return !error;
}
