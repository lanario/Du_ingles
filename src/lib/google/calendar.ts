import "server-only";
import { randomUUID } from "node:crypto";
import { GoogleAuthError } from "@/lib/google/oauth";

/**
 * Google Calendar API v3 por `fetch`. Só o que a plataforma usa: criar,
 * atualizar e apagar o evento de uma aula na agenda principal do usuário.
 */

const BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export interface CalendarEventBody {
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  reminders: {
    useDefault: false;
    overrides: Array<{ method: "popup" | "email"; minutes: number }>;
  };
  source?: { title: string; url: string };
  extendedProperties?: { private: Record<string, string> };
}

export interface CreatedEvent {
  id: string;
  meetUrl: string | null;
}

interface RawEvent {
  id?: string;
  hangoutLink?: string;
  conferenceData?: { entryPoints?: Array<{ entryPointType?: string; uri?: string }> };
}

function meetOf(event: RawEvent): string | null {
  if (event.hangoutLink) return event.hangoutLink;
  const video = event.conferenceData?.entryPoints?.find(
    (p) => p.entryPointType === "video",
  );
  return video?.uri ?? null;
}

async function call(
  accessToken: string,
  path: string,
  init: RequestInit,
): Promise<Response> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (response.status === 401) throw new GoogleAuthError("unauthorized");
  return response;
}

async function failure(action: string, response: Response): Promise<Error> {
  const text = await response.text().catch(() => "");
  return new Error(`Google Calendar ${action}: ${response.status} ${text.slice(0, 200)}`);
}

/**
 * Cria o evento. Com `withMeet`, pede a sala do Meet junto: sem
 * `conferenceDataVersion=1` o Google ignora o pedido e cria o evento sem link.
 * `sendUpdates=none`: o aviso que o usuário recebe é o lembrete do próprio
 * evento, não um e-mail de convite.
 */
export async function insertEvent(
  accessToken: string,
  body: CalendarEventBody,
  withMeet: boolean,
): Promise<CreatedEvent> {
  const payload = withMeet
    ? {
        ...body,
        conferenceData: {
          createRequest: {
            requestId: randomUUID(),
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      }
    : body;

  const response = await call(accessToken, "?conferenceDataVersion=1&sendUpdates=none", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await failure("insert", response);

  const event = (await response.json()) as RawEvent;
  if (!event.id) throw new Error("Google Calendar não devolveu o id do evento.");

  let meetUrl = withMeet ? meetOf(event) : null;
  if (withMeet && !meetUrl) {
    // A sala às vezes fica "pending" por um instante; uma segunda leitura resolve.
    await new Promise((resolve) => setTimeout(resolve, 800));
    const again = await call(accessToken, `/${encodeURIComponent(event.id)}`, {
      method: "GET",
    });
    if (again.ok) meetUrl = meetOf((await again.json()) as RawEvent);
  }
  return { id: event.id, meetUrl };
}

/** `false` quando o evento não existe mais (o usuário o apagou na agenda dele). */
export async function patchEvent(
  accessToken: string,
  eventId: string,
  body: Partial<CalendarEventBody>,
): Promise<boolean> {
  const response = await call(
    accessToken,
    `/${encodeURIComponent(eventId)}?sendUpdates=none`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
  if (response.status === 404 || response.status === 410) return false;
  if (!response.ok) throw await failure("patch", response);
  // Evento apagado pelo usuário volta como "cancelled" em alguns casos.
  const event = (await response.json().catch(() => ({}))) as { status?: string };
  return event.status !== "cancelled";
}

export async function deleteEvent(accessToken: string, eventId: string): Promise<void> {
  const response = await call(
    accessToken,
    `/${encodeURIComponent(eventId)}?sendUpdates=none`,
    { method: "DELETE" },
  );
  if (response.ok || response.status === 404 || response.status === 410) return;
  throw await failure("delete", response);
}
