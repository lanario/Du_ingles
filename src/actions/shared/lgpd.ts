"use server";

import { requireRole } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit";
import { notifyLgpdRequest } from "@/lib/notifications/events";
import { ok, type ActionResult } from "@/types/action-result";

/**
 * Direito de exclusão (LGPD art. 18, V) implementado como SOLICITAÇÃO, não
 * autoexclusão instantânea: dados pedagógicos (frequência, notas) têm
 * retenção legal/contratual e precisam de triagem humana antes de apagar —
 * a política de privacidade já promete isso. A ação só registra o pedido
 * (auditoria + notificação aos admins); a exclusão em si usa o fluxo de
 * "desativar/excluir usuário" que o admin já tem em /admin/usuarios/[id].
 */
export async function requestDataDeletionAction(): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin", "teacher", "student"]);

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "LGPD_DELETION_REQUESTED",
    entityType: "profile",
    entityId: ctx.userId,
  });

  notifyLgpdRequest({
    organizationId: ctx.organizationId,
    requesterId: ctx.userId,
    requesterName: `${ctx.fullName} (${ctx.email})`,
  });

  return ok(undefined as never);
}
