import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface AuditLogEntry {
  id: number;
  action: string;
  actorId: string | null;
  actorRole: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
}

/** Passa pela RLS normal (`audit_logs_select_admin`) — não precisa de admin client. */
export async function listAuditLogs(limit = 50): Promise<AuditLogEntry[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select(
      "id, action, actor_id, actor_role, entity_type, entity_id, metadata, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    action: row.action,
    actorId: row.actor_id,
    actorRole: row.actor_role,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata,
    createdAt: row.created_at,
  }));
}
