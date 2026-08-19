"use server";

import { requireRole } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";
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

  const admin = createAdminSupabaseClient();
  const { data: admins } = await admin
    .from("profiles")
    .select("id")
    .eq("organization_id", ctx.organizationId)
    .eq("role", "admin")
    .eq("is_active", true);

  if (admins && admins.length > 0) {
    await admin.from("notifications").insert(
      admins.map((a) => ({
        organization_id: ctx.organizationId,
        recipient_id: a.id,
        type: "lgpd_request",
        title: "Solicitação de exclusão de dados (LGPD)",
        body: `${ctx.email} solicitou a exclusão dos próprios dados pessoais.`,
        link: `/admin/usuarios/${ctx.userId}`,
      })),
    );
  }

  return ok(undefined as never);
}
