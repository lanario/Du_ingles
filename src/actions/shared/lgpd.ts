"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { notifyLgpdRequest } from "@/lib/notifications/events";
import {
  LGPD_REQUEST_KINDS,
  meusDadosPath,
  type LgpdRequestView,
} from "@/lib/lgpd/requests";
import * as requestsRepo from "@/repositories/lgpd-requests";
import { fail, ok, type ActionResult } from "@/types/action-result";

const createRequestSchema = z
  .object({
    kind: z.enum(LGPD_REQUEST_KINDS, { error: "Escolha o tipo de pedido." }),
    details: z
      .string()
      .trim()
      .max(2000, "A descrição passou de 2000 caracteres.")
      .optional()
      .transform((value) => value || null),
  })
  .superRefine((value, ctx) => {
    // Sem descrição, "correção" e "outro" não dão à coordenação o que fazer.
    const needsDetails = ["rectification", "automated_review", "other"];
    if (needsDetails.includes(value.kind) && !value.details) {
      ctx.addIssue({
        code: "custom",
        path: ["details"],
        message: "Descreva o pedido para podermos atendê-lo.",
      });
    }
  });

/**
 * Pedido do titular (LGPD art. 18). Vira linha em `lgpd_requests` com
 * protocolo e prazo de 15 dias (art. 19), a coordenação é avisada e o
 * titular acompanha em "Meus dados".
 *
 * A exclusão continua sendo SOLICITAÇÃO, não autoexclusão: há carência de
 * 7 dias para desistir e a coordenação confere pendências (turmas,
 * assinatura) antes de executar a anonimização.
 */
export async function createLgpdRequestAction(
  _prev: ActionResult<LgpdRequestView> | null,
  formData: FormData,
): Promise<ActionResult<LgpdRequestView>> {
  const ctx = await requireRole(["admin", "teacher", "student"]);

  const parsed = createRequestSchema.safeParse({
    kind: formData.get("kind"),
    details: formData.get("details") || undefined,
  });
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors as Record<string, string[]>;
    const first = Object.values(fields).flat()[0] ?? "Confira o pedido.";
    return fail("VALIDATION_ERROR", first, fields);
  }

  const allowed = await checkRateLimit(ctx.userId, "lgpd_request", 10, 86400);
  if (!allowed) {
    return fail(
      "RATE_LIMITED",
      "Você abriu muitos pedidos hoje. Aguarde a resposta dos que já estão abertos.",
    );
  }

  const result = await requestsRepo.createLgpdRequest({
    organizationId: ctx.organizationId,
    requesterId: ctx.userId,
    requesterName: ctx.fullName,
    requesterEmail: ctx.email,
    kind: parsed.data.kind,
    details: parsed.data.details,
  });

  if (!result.ok) {
    return result.reason === "duplicate"
      ? fail(
          "CONFLICT",
          "Você já tem um pedido deste tipo em andamento. Acompanhe por ele abaixo.",
        )
      : fail("INTERNAL_ERROR", "Não foi possível registrar o pedido. Tente de novo.");
  }

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "LGPD_REQUEST_CREATED",
    entityType: "lgpd_request",
    entityId: result.request.id,
    metadata: { protocol: result.request.protocol, kind: result.request.kind },
  });

  notifyLgpdRequest({
    organizationId: ctx.organizationId,
    requesterId: ctx.userId,
    requesterName: ctx.fullName,
    kind: result.request.kind,
    protocol: result.request.protocol,
    dueAt: result.request.dueAt,
  });

  revalidatePath(meusDadosPath(ctx.realRole));
  return ok(result.request);
}

/** Desistir do próprio pedido enquanto ele ainda não foi atendido. */
export async function cancelLgpdRequestAction(
  requestId: string,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin", "teacher", "student"]);

  const request = await requestsRepo.getLgpdRequest(requestId);
  // Mesmo erro para "não existe" e "não é seu": não confirma a existência de
  // pedidos de outras pessoas.
  if (!request || request.requesterId !== ctx.userId) {
    return fail("NOT_FOUND", "Pedido não encontrado.");
  }

  const changed = await requestsRepo.transitionLgpdRequest({
    id: requestId,
    organizationId: request.organizationId,
    status: "canceled",
    handledBy: null,
    resolution: "Cancelado pelo próprio titular.",
  });
  if (!changed) {
    return fail(
      "CONFLICT",
      "Este pedido já foi concluído e não pode mais ser cancelado.",
    );
  }

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "LGPD_REQUEST_CANCELED",
    entityType: "lgpd_request",
    entityId: requestId,
    metadata: { protocol: request.protocol },
  });

  revalidatePath(meusDadosPath(ctx.realRole));
  return ok(undefined as never);
}

/** Lista dos próprios pedidos — o modal de perfil é cliente e busca por aqui. */
export async function listMyLgpdRequestsAction(): Promise<LgpdRequestView[]> {
  const ctx = await requireRole(["admin", "teacher", "student"]);
  return requestsRepo.listMyLgpdRequests(ctx.userId);
}
