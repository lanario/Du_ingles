import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  OPEN_STATUSES,
  type LgpdQueueItem,
  type LgpdRequestKind,
  type LgpdRequestStatus,
  type LgpdRequestView,
} from "@/lib/lgpd/requests";
import type { AppRole } from "@/types/domain";

/**
 * `lgpd_requests` não tem policy para `authenticated` (migration 0052): toda
 * leitura e escrita passa por aqui, via service-role, e quem chama já
 * conferiu a identidade — o titular só enxerga as linhas com o próprio
 * `requester_id`, a coordenação só as da própria organização.
 */

const VIEW_COLUMNS =
  "id, protocol, kind, status, details, resolution, due_at, created_at, resolved_at";

interface RequestRow {
  id: string;
  protocol: string;
  kind: string;
  status: string;
  details: string | null;
  resolution: string | null;
  due_at: string;
  created_at: string;
  resolved_at: string | null;
}

function toView(row: RequestRow): LgpdRequestView {
  return {
    id: row.id,
    protocol: row.protocol,
    kind: row.kind as LgpdRequestKind,
    status: row.status as LgpdRequestStatus,
    details: row.details,
    resolution: row.resolution,
    dueAt: row.due_at,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

export type CreateRequestResult =
  { ok: true; request: LgpdRequestView } | { ok: false; reason: "duplicate" | "error" };

export async function createLgpdRequest(input: {
  organizationId: string;
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  kind: LgpdRequestKind;
  details: string | null;
}): Promise<CreateRequestResult> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("lgpd_requests")
    .insert({
      organization_id: input.organizationId,
      requester_id: input.requesterId,
      requester_name: input.requesterName,
      requester_email: input.requesterEmail,
      kind: input.kind,
      details: input.details,
    })
    .select(VIEW_COLUMNS)
    .single();

  if (error) {
    // 23505: o índice parcial `lgpd_requests_one_open_per_kind` recusou.
    return { ok: false, reason: error.code === "23505" ? "duplicate" : "error" };
  }
  return { ok: true, request: toView(data) };
}

export async function listMyLgpdRequests(
  requesterId: string,
): Promise<LgpdRequestView[]> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("lgpd_requests")
    .select(VIEW_COLUMNS)
    .eq("requester_id", requesterId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []).map(toView);
}

export async function listLgpdQueue(organizationId: string): Promise<LgpdQueueItem[]> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("lgpd_requests")
    .select(`${VIEW_COLUMNS}, requester_id, requester_name, requester_email, handled_by`)
    .eq("organization_id", organizationId)
    .order("due_at", { ascending: true })
    .limit(300);

  const rows = data ?? [];
  const ids = [
    ...new Set(rows.flatMap((row) => [row.requester_id, row.handled_by]).filter(Boolean)),
  ] as string[];

  const profiles = new Map<
    string,
    { name: string; role: AppRole; anonymized: boolean }
  >();
  if (ids.length > 0) {
    const { data: people } = await admin
      .from("profiles")
      .select("id, full_name, role, anonymized_at")
      .in("id", ids);
    for (const person of people ?? []) {
      profiles.set(person.id, {
        name: person.full_name,
        role: person.role as AppRole,
        anonymized: person.anonymized_at !== null,
      });
    }
  }

  const items = rows.map((row) => {
    const requester = row.requester_id ? profiles.get(row.requester_id) : undefined;
    return {
      ...toView(row),
      requesterId: row.requester_id,
      requesterName: row.requester_name,
      requesterEmail: row.requester_email,
      requesterRole: requester?.role ?? null,
      requesterAnonymized: requester?.anonymized ?? false,
      handledByName: row.handled_by ? (profiles.get(row.handled_by)?.name ?? null) : null,
    };
  });

  // Abertos primeiro (por prazo), depois o histórico do mais recente ao mais antigo.
  const open = items.filter((item) => OPEN_STATUSES.includes(item.status));
  const closed = items
    .filter((item) => !OPEN_STATUSES.includes(item.status))
    .sort((a, b) =>
      (b.resolvedAt ?? b.createdAt).localeCompare(a.resolvedAt ?? a.createdAt),
    );
  return [...open, ...closed];
}

export async function countOpenLgpdRequests(organizationId: string): Promise<number> {
  const admin = createAdminSupabaseClient();
  const { count } = await admin
    .from("lgpd_requests")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .in("status", [...OPEN_STATUSES]);
  return count ?? 0;
}

export interface LgpdRequestRecord extends LgpdRequestView {
  organizationId: string;
  requesterId: string | null;
  requesterName: string;
}

export async function getLgpdRequest(id: string): Promise<LgpdRequestRecord | null> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("lgpd_requests")
    .select(`${VIEW_COLUMNS}, organization_id, requester_id, requester_name`)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return {
    ...toView(data),
    organizationId: data.organization_id,
    requesterId: data.requester_id,
    requesterName: data.requester_name,
  };
}

/**
 * Só avança pedidos ainda abertos: o `in("status", …)` faz a transição ser
 * condicional no próprio UPDATE, então dois cliques (ou duas abas) não
 * reabrem nem fecham duas vezes o mesmo pedido.
 */
export async function transitionLgpdRequest(input: {
  id: string;
  organizationId: string;
  status: LgpdRequestStatus;
  handledBy: string | null;
  resolution?: string | null;
}): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const closing = !OPEN_STATUSES.includes(input.status);
  const { data, error } = await admin
    .from("lgpd_requests")
    .update({
      status: input.status,
      handled_by: input.handledBy,
      ...(input.resolution !== undefined ? { resolution: input.resolution } : {}),
      resolved_at: closing ? new Date().toISOString() : null,
    })
    .eq("id", input.id)
    .eq("organization_id", input.organizationId)
    .in("status", [...OPEN_STATUSES])
    .select("id");
  return !error && (data?.length ?? 0) > 0;
}

/** Papel atual de quem pediu — decide o link do aviso de retorno. */
export async function getRequesterRole(
  requesterId: string,
): Promise<{ role: AppRole; anonymized: boolean } | null> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("profiles")
    .select("role, anonymized_at")
    .eq("id", requesterId)
    .maybeSingle();
  return data
    ? { role: data.role as AppRole, anonymized: data.anonymized_at !== null }
    : null;
}
