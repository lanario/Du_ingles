import "server-only";
import { after } from "next/server";
import { ADMIN_BASE, TEACHER_BASE } from "@/lib/areas";
import { isGoogleConfigured } from "@/lib/env";
import {
  deleteEvent,
  insertEvent,
  patchEvent,
  type CalendarEventBody,
} from "@/lib/google/calendar";
import {
  accessTokenFor,
  connectedProfiles,
  deleteConnection,
} from "@/lib/google/connection";
import { MEET_OPENS_MINUTES_BEFORE } from "@/lib/google/meet-access";
import { siteUrl } from "@/lib/google/oauth";
import { agendaPath } from "@/lib/google/paths";
import { dispatchNotifications, type Recipient } from "@/lib/notifications/dispatch";
import { groupStudents, resolveRecipients } from "@/lib/notifications/audience";
import { SCHOOL_TZ } from "@/lib/schedule/session-preview";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { AppRole } from "@/types/domain";

/**
 * Espelha as aulas do sistema na agenda Google de cada participante.
 *
 * - Cada pessoa (professor e alunos) tem o SEU evento, na própria agenda.
 * - O Meet é criado junto com o evento do professor (o anfitrião) e vale para
 *   a aula inteira. O do aluno nasce sem link: o Google mostraria o Meet na
 *   hora, e a regra é que o aluno só o veja 30 min antes, dentro da
 *   plataforma (ver `meet-access.ts`).
 * - A plataforma é a fonte da verdade: nada aqui lança para quem chamou.
 */

const PENDING = "pending";
/** Quanto tempo uma "reserva" de criação vale antes de ser tida como abandonada. */
const CLAIM_TTL_MS = 2 * 60_000;
/** Janela do preenchimento preguiçoso: as aulas que o banco gera vêm 28 dias à frente. */
const BACKFILL_DAYS = 28;
const BACKFILL_MAX = 60;

/** Roda depois da resposta; fora de um request (script) roda direto. */
function later(task: () => Promise<unknown>): void {
  const guarded = async () => {
    try {
      await task();
    } catch (error) {
      console.error("[google] falha na sincronização:", error);
    }
  };
  try {
    after(guarded);
  } catch {
    void guarded();
  }
}

/* ------------------------------------------------------------ montagem */

interface SessionData {
  id: string;
  organizationId: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  groupId: string;
  teacherId: string;
}

async function loadSession(sessionId: string): Promise<SessionData | null> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("class_sessions")
    .select(
      "id, organization_id, title, scheduled_at, duration_minutes, status, group_id, teacher_id",
    )
    .eq("id", sessionId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    organizationId: data.organization_id,
    title: data.title,
    scheduledAt: data.scheduled_at,
    durationMinutes: data.duration_minutes,
    status: data.status,
    groupId: data.group_id,
    teacherId: data.teacher_id,
  };
}

function agendaUrl(role: AppRole): string {
  const path =
    role === "student"
      ? "/agenda"
      : `${role === "admin" ? ADMIN_BASE : TEACHER_BASE}/agenda`;
  return `${siteUrl()}${path}`;
}

function buildBody(input: {
  session: SessionData;
  groupName: string;
  teacherName: string;
  studentNames: string[];
  viewer: AppRole;
}): CalendarEventBody {
  const { session, groupName, teacherName, studentNames, viewer } = input;
  const start = new Date(session.scheduledAt);
  const end = new Date(start.getTime() + session.durationMinutes * 60_000);

  const lines = [
    `Turma: ${groupName}`,
    `Professor(a): ${teacherName}`,
    `Duração: ${session.durationMinutes} min`,
  ];
  if (viewer === "student") {
    lines.push(
      "",
      `O link do Google Meet é liberado na plataforma ${MEET_OPENS_MINUTES_BEFORE} minutos antes da aula:`,
      agendaUrl("student"),
    );
  } else {
    if (studentNames.length > 0) lines.push(`Alunos: ${studentNames.join(", ")}`);
    lines.push("", `Agenda na plataforma: ${agendaUrl(viewer)}`);
  }

  return {
    summary: `${session.title} · ${groupName}`,
    description: lines.join("\n"),
    start: { dateTime: start.toISOString(), timeZone: SCHOOL_TZ },
    end: { dateTime: end.toISOString(), timeZone: SCHOOL_TZ },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: MEET_OPENS_MINUTES_BEFORE },
        { method: "email", minutes: 60 },
      ],
    },
    source: { title: "Du Inglês", url: agendaUrl(viewer) },
    extendedProperties: { private: { duIngles: "1", sessionId: session.id } },
  };
}

/* ----------------------------------------------------------- um evento */

async function upsertEvent(input: {
  accessToken: string;
  session: SessionData;
  profileId: string;
  isHost: boolean;
  body: CalendarEventBody;
}): Promise<void> {
  const { accessToken, session, profileId, isHost, body } = input;
  const admin = createAdminSupabaseClient();

  const { data: link } = await admin
    .from("google_event_links")
    .select("google_event_id, synced_at")
    .eq("session_id", session.id)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (link?.google_event_id === PENDING) {
    // Outra execução está criando este evento agora.
    if (Date.now() - new Date(link.synced_at).getTime() < CLAIM_TTL_MS) return;
    await admin
      .from("google_event_links")
      .delete()
      .eq("session_id", session.id)
      .eq("profile_id", profileId);
  } else if (link) {
    // O anfitrião sem link do Meet salvo não tem como ganhar um por PATCH sem
    // recriar a sala: apaga e cria de novo.
    const { data: meet } = isHost
      ? await admin
          .from("session_meet_links")
          .select("session_id")
          .eq("session_id", session.id)
          .maybeSingle()
      : { data: { session_id: session.id } };

    if (meet) {
      const alive = await patchEvent(accessToken, link.google_event_id, body);
      if (alive) {
        await admin
          .from("google_event_links")
          .update({
            synced_start: session.scheduledAt,
            synced_at: new Date().toISOString(),
          })
          .eq("session_id", session.id)
          .eq("profile_id", profileId);
        return;
      }
    } else {
      await deleteEvent(accessToken, link.google_event_id);
    }
    await admin
      .from("google_event_links")
      .delete()
      .eq("session_id", session.id)
      .eq("profile_id", profileId);
  }

  // Reserva a vaga antes de falar com o Google: duas execuções ao mesmo tempo
  // (duas abas abrindo a agenda) não criam o evento em dobro.
  const { data: claimed } = await admin
    .from("google_event_links")
    .upsert(
      {
        session_id: session.id,
        profile_id: profileId,
        google_event_id: PENDING,
        synced_start: session.scheduledAt,
        synced_at: new Date().toISOString(),
      },
      { onConflict: "session_id,profile_id", ignoreDuplicates: true },
    )
    .select("session_id");
  if (!claimed || claimed.length === 0) return;

  try {
    const created = await insertEvent(accessToken, body, isHost);
    await admin
      .from("google_event_links")
      .update({ google_event_id: created.id, synced_at: new Date().toISOString() })
      .eq("session_id", session.id)
      .eq("profile_id", profileId);

    if (isHost) {
      if (created.meetUrl) {
        await admin.from("session_meet_links").upsert(
          {
            session_id: session.id,
            host_profile_id: profileId,
            meet_url: created.meetUrl,
          },
          { onConflict: "session_id" },
        );
      } else {
        console.error(
          "[google] o Google não devolveu o link do Meet para a aula",
          session.id,
        );
      }
    }
  } catch (error) {
    await admin
      .from("google_event_links")
      .delete()
      .eq("session_id", session.id)
      .eq("profile_id", profileId);
    throw error;
  }
}

/* ------------------------------------------------------------ a aula */

/**
 * Cria ou atualiza o evento da aula para o professor e os alunos que
 * conectaram o Google. Com `onlyProfileId`, mexe só no evento dessa pessoa
 * (preenchimento preguiçoso, sem tocar na agenda dos outros).
 */
export async function syncSession(
  sessionId: string,
  options: { onlyProfileId?: string } = {},
): Promise<void> {
  if (!isGoogleConfigured()) return;

  const session = await loadSession(sessionId);
  if (!session) return;
  if (session.status === "cancelled") {
    await removeSessionEvents(sessionId);
    return;
  }
  if (session.status === "completed") return;

  const admin = createAdminSupabaseClient();
  const [students, teachers, { data: group }] = await Promise.all([
    groupStudents(session.groupId),
    resolveRecipients([session.teacherId]),
    admin.from("groups").select("name").eq("id", session.groupId).maybeSingle(),
  ]);
  const teacher = teachers[0];
  if (!teacher) return;

  const participants: Recipient[] = [
    teacher,
    ...students.filter((s) => s.id !== teacher.id),
  ];
  const connected = await connectedProfiles(participants.map((p) => p.id));

  const shared = {
    session,
    groupName: group?.name ?? "",
    teacherName: teacher.name,
    studentNames: students.map((s) => s.name),
  };

  for (const person of participants) {
    if (options.onlyProfileId && person.id !== options.onlyProfileId) continue;
    if (!connected.has(person.id)) continue;

    try {
      const accessToken = await accessTokenFor(person.id, person.role);
      if (!accessToken) continue;
      await upsertEvent({
        accessToken,
        session,
        profileId: person.id,
        isHost: person.id === teacher.id,
        body: buildBody({
          ...shared,
          viewer: person.id === teacher.id ? person.role : "student",
        }),
      });
    } catch (error) {
      console.error(`[google] evento da aula ${sessionId} (${person.id}):`, error);
    }
  }

  if (options.onlyProfileId) return;

  // Quem saiu da aula (aluno desmatriculado, professor trocado) perde o evento.
  const { data: links } = await admin
    .from("google_event_links")
    .select("profile_id")
    .eq("session_id", sessionId);
  const inside = new Set(participants.map((p) => p.id));
  for (const link of links ?? []) {
    if (!inside.has(link.profile_id))
      await removeSessionEventFor(sessionId, link.profile_id);
  }

  // Professor sem Google: a aula existe, mas sem link. Avisa (no máx. a cada 3 dias).
  if (!connected.has(teacher.id)) {
    await dispatchNotifications({
      organizationId: session.organizationId,
      recipients: [teacher],
      dedupe: { withinMinutes: 3 * 24 * 60 },
      build: (recipient) => ({
        type: "google_meet_missing",
        title: "Conecte o Google Agenda para gerar o link do Meet",
        body: "Suas aulas só recebem o link do Google Meet depois que você conecta a agenda.",
        link: agendaPath(recipient.role),
      }),
    });
  }
}

/** Agenda a sincronização para depois da resposta. Nunca lança. */
export function queueSessionSync(sessionId: string): void {
  if (!isGoogleConfigured()) return;
  later(() => syncSession(sessionId));
}

/** Apaga o evento de uma pessoa numa aula (e a linha de controle). */
export async function removeSessionEventFor(
  sessionId: string,
  profileId: string,
): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { data: link } = await admin
    .from("google_event_links")
    .select("google_event_id")
    .eq("session_id", sessionId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!link) return;

  if (link.google_event_id !== PENDING) {
    try {
      const [person] = await resolveRecipients([profileId]);
      const accessToken = person ? await accessTokenFor(profileId, person.role) : null;
      if (accessToken) await deleteEvent(accessToken, link.google_event_id);
    } catch (error) {
      console.error(`[google] apagar evento ${sessionId} (${profileId}):`, error);
    }
  }
  await admin
    .from("google_event_links")
    .delete()
    .eq("session_id", sessionId)
    .eq("profile_id", profileId);
}

/**
 * Apaga os eventos da aula na agenda de todo mundo. Chamar ANTES de apagar a
 * linha da aula: o `on delete cascade` levaria junto os ids dos eventos, e o
 * Google ficaria com a aula fantasma.
 */
export async function removeSessionEvents(sessionId: string): Promise<void> {
  if (!isGoogleConfigured()) return;
  const admin = createAdminSupabaseClient();
  const { data: links } = await admin
    .from("google_event_links")
    .select("profile_id")
    .eq("session_id", sessionId);

  for (const link of links ?? []) await removeSessionEventFor(sessionId, link.profile_id);
  await admin.from("session_meet_links").delete().eq("session_id", sessionId);
}

/** Igual a `removeSessionEvents`, para várias aulas (ex.: grade da turma mudou). */
export async function removeManySessionEvents(
  sessionIds: readonly string[],
): Promise<void> {
  for (const id of sessionIds) {
    try {
      await removeSessionEvents(id);
    } catch (error) {
      console.error(`[google] limpar eventos da aula ${id}:`, error);
    }
  }
}

/* ---------------------------------------------------- preenchimento */

const inflight = new Map<string, Promise<void>>();

/**
 * Sincroniza as aulas dos próximos 28 dias deste usuário que ainda não têm
 * evento. Cobre as aulas geradas pelo banco (pg_cron, sem passar por código) e
 * quem acabou de conectar o Google. Várias chamadas simultâneas viram uma.
 */
export function backfillForProfile(profileId: string, role: AppRole): Promise<void> {
  if (!isGoogleConfigured()) return Promise.resolve();
  const running = inflight.get(profileId);
  if (running) return running;

  const task = (async () => {
    const admin = createAdminSupabaseClient();
    if (!(await connectedProfiles([profileId])).has(profileId)) return;

    const from = new Date(Date.now() - 2 * 3_600_000).toISOString();
    const until = new Date(Date.now() + BACKFILL_DAYS * 86_400_000).toISOString();

    let query = admin
      .from("class_sessions")
      .select("id")
      .eq("status", "scheduled")
      .gte("scheduled_at", from)
      .lte("scheduled_at", until)
      .order("scheduled_at", { ascending: true })
      .limit(BACKFILL_MAX);

    if (role === "student") {
      const { data: enrollments } = await admin
        .from("enrollments")
        .select("group_id")
        .eq("student_id", profileId)
        .eq("status", "active");
      const groupIds = (enrollments ?? []).map((row) => row.group_id);
      if (groupIds.length === 0) return;
      query = query.in("group_id", groupIds);
    } else {
      query = query.eq("teacher_id", profileId);
    }

    const { data: sessions } = await query;
    const ids = (sessions ?? []).map((row) => row.id);
    if (ids.length === 0) return;

    const { data: existing } = await admin
      .from("google_event_links")
      .select("session_id")
      .eq("profile_id", profileId)
      .in("session_id", ids);
    const done = new Set((existing ?? []).map((row) => row.session_id));

    for (const id of ids) {
      if (done.has(id)) continue;
      await syncSession(id, { onlyProfileId: profileId });
    }
  })()
    .catch((error) => console.error("[google] preenchimento:", error))
    .finally(() => inflight.delete(profileId));

  inflight.set(profileId, task);
  return task;
}

/** Depois da resposta, sem segurar a página. */
export function queueBackfill(profileId: string, role: AppRole): void {
  if (!isGoogleConfigured()) return;
  later(() => backfillForProfile(profileId, role));
}

/* -------------------------------------------------------- desconectar */

/** Apaga da agenda do usuário os eventos que a plataforma criou e desfaz a conexão. */
export async function disconnectAndCleanup(profileId: string): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { data: links } = await admin
    .from("google_event_links")
    .select("session_id")
    .eq("profile_id", profileId);

  for (const link of links ?? []) {
    await removeSessionEventFor(link.session_id, profileId);
  }
  // Aulas em que este usuário era o anfitrião ficam sem Meet.
  await admin.from("session_meet_links").delete().eq("host_profile_id", profileId);
  await deleteConnection(profileId);
}

/* ------------------------------------------- limpeza antes de apagar */

export interface EventSnapshot {
  profileId: string;
  eventId: string;
}

/**
 * Foto dos eventos de aulas que vão ser APAGADAS do banco. O `on delete
 * cascade` leva as linhas de controle junto, então quem vai apagar a aula
 * tira a foto antes e entrega para `queueEventCleanup` depois.
 */
export async function snapshotEvents(
  sessionIds: readonly string[],
): Promise<EventSnapshot[]> {
  if (!isGoogleConfigured() || sessionIds.length === 0) return [];
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("google_event_links")
    .select("profile_id, google_event_id")
    .in("session_id", [...sessionIds])
    .neq("google_event_id", PENDING);
  return (data ?? []).map((row) => ({
    profileId: row.profile_id,
    eventId: row.google_event_id,
  }));
}

/** Apaga os eventos da foto no Google, depois da resposta. Nunca lança. */
export function queueEventCleanup(snapshots: readonly EventSnapshot[]): void {
  if (!isGoogleConfigured() || snapshots.length === 0) return;
  later(async () => {
    const byProfile = new Map<string, string[]>();
    for (const { profileId, eventId } of snapshots) {
      byProfile.set(profileId, [...(byProfile.get(profileId) ?? []), eventId]);
    }
    for (const [profileId, eventIds] of byProfile) {
      const [person] = await resolveRecipients([profileId]);
      const accessToken = person ? await accessTokenFor(profileId, person.role) : null;
      if (!accessToken) continue;
      for (const eventId of eventIds) {
        try {
          await deleteEvent(accessToken, eventId);
        } catch (error) {
          console.error(`[google] apagar evento ${eventId}:`, error);
        }
      }
    }
  });
}

/** Cancelamento: a linha da aula fica, os eventos saem da agenda de todos. */
export function queueSessionCleanup(sessionId: string): void {
  if (!isGoogleConfigured()) return;
  later(() => removeSessionEvents(sessionId));
}

/** Várias aulas de uma vez (troca de professor da turma), em fila, depois da resposta. */
export function queueSessionsSync(sessionIds: readonly string[]): void {
  if (!isGoogleConfigured() || sessionIds.length === 0) return;
  later(async () => {
    for (const id of sessionIds) {
      try {
        await syncSession(id);
      } catch (error) {
        console.error(`[google] sincronizar aula ${id}:`, error);
      }
    }
  });
}
