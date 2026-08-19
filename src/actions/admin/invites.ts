"use server";

import { requireRole } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit";
import * as invitesService from "@/services/invites";
import { createInviteSchema } from "@/schemas/invites";
import { fail, ok, type ActionResult } from "@/types/action-result";

/**
 * Gera o convite e devolve o link + a mensagem pronta do WhatsApp. Não
 * envia nada: o disparo é manual, pelo próprio WhatsApp do admin, que é o
 * canal onde a escola já fala com aluno e professor.
 *
 * O link em claro só existe nesta resposta — o banco guarda apenas o hash.
 * Se o admin fechar o painel sem enviar, o caminho é gerar outro convite
 * (o que revoga este).
 */
export async function createInviteAction(
  _prev: ActionResult<invitesService.InviteDelivery> | null,
  formData: FormData,
): Promise<ActionResult<invitesService.InviteDelivery>> {
  const ctx = await requireRole(["admin"]);

  const parsed = createInviteSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const result = await invitesService.createInvite(
    parsed.data,
    ctx.organizationId,
    ctx.userId,
  );
  if (!result.success) {
    return fail("INTERNAL_ERROR", result.message);
  }

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "USER_INVITE_CREATE",
    entityType: "user_invite",
    entityId: result.data.inviteId,
    // Sem o token: log de auditoria é lido por gente, e um link válido ali
    // dentro seria uma credencial em texto plano.
    metadata: { role: parsed.data.role, phone: parsed.data.phone },
  });

  return ok(result.data);
}
