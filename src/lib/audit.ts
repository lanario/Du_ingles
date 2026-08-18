import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { AppRole } from "@/types/domain";
import type { Json } from "@/types/database.types";

interface AuditLogInput {
  organizationId: string;
  actorId: string | null;
  actorRole: AppRole | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, Json>;
}

/**
 * `audit_logs` não tem policy de insert para `authenticated` (§5.3) — a
 * escrita é sempre via service-role, o que também impede um cliente
 * comprometido de forjar ou apagar o próprio rastro de auditoria.
 */
export async function auditLog(input: AuditLogInput): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("audit_logs").insert({
    organization_id: input.organizationId,
    actor_id: input.actorId,
    actor_role: input.actorRole,
    action: input.action,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) {
    console.error(`[audit] falha ao registrar "${input.action}":`, error.message);
  }
}
