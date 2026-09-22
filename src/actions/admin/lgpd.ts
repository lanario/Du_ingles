"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit";
import { ADMIN_BASE } from "@/lib/areas";
import { notifyLgpdRequestUpdated } from "@/lib/notifications/events";
import {
  ANONYMIZE_CONFIRMATION,
  DELETION_GRACE_DAYS,
  OPEN_STATUSES,
  RESOLUTION_STATUSES,
  deletionAvailableAt,
  formatDate,
  type LgpdRequestStatus,
} from "@/lib/lgpd/requests";
import * as requestsRepo from "@/repositories/lgpd-requests";
import { anonymizeUser } from "@/services/lgpd-erasure";
import { fail, ok, type ActionResult } from "@/types/action-result";

const QUEUE_PATH = `${ADMIN_BASE}/lgpd`;

async function loadOwnRequest(requestId: string, organizationId: string) {
  const request = await requestsRepo.getLgpdRequest(requestId);
  if (!request || request.organizationId !== organizationId) return null;
  return request;
}

async function notifyRequester(
  request: { requesterId: string | null; organizationId: string; protocol: string },
  status: LgpdRequestStatus,
) {
  if (!request.requesterId) return;
  const requester = await requestsRepo.getRequesterRole(request.requesterId);
  // Titular anonimizado não tem mais conta para receber aviso.
  if (!requester || requester.anonymized) return;
  notifyLgpdRequestUpdated({
    organizationId: request.organizationId,
    requesterId: request.requesterId,
    requesterRole: requester.role,
    requesterName: "",
    protocol: request.protocol,
    status,
  });
}

/** "Assumir": sinaliza ao titular e aos colegas que alguém está cuidando. */
export async function startLgpdRequestAction(
  requestId: string,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);
  const request = await loadOwnRequest(requestId, ctx.organizationId);
  if (!request) return fail("NOT_FOUND", "Pedido não encontrado.");
  if (request.status !== "open")
    return fail("CONFLICT", "Este pedido já está em andamento.");

  const changed = await requestsRepo.transitionLgpdRequest({
    id: requestId,
    organizationId: ctx.organizationId,
    status: "in_progress",
    handledBy: ctx.userId,
  });
  if (!changed)
    return fail("CONFLICT", "O pedido mudou enquanto você olhava. Recarregue.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "LGPD_REQUEST_STARTED",
    entityType: "lgpd_request",
    entityId: requestId,
    metadata: { protocol: request.protocol },
  });
  await notifyRequester(request, "in_progress");

  revalidatePath(QUEUE_PATH);
  return ok(undefined as never);
}

const resolveSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(RESOLUTION_STATUSES as [LgpdRequestStatus, ...LgpdRequestStatus[]], {
    error: "Escolha o resultado.",
  }),
  resolution: z
    .string()
    .trim()
    .min(10, "Explique ao titular o que foi feito (mínimo de 10 caracteres).")
    .max(2000, "A resposta passou de 2000 caracteres."),
});

/**
 * Conclui o pedido com uma resposta que o titular lê em "Meus dados". Recusa
 * total ou parcial precisa dizer o motivo (art. 18 §4 e art. 19 §1) — daí a
 * resposta obrigatória em qualquer desfecho.
 */
export async function resolveLgpdRequestAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);
  const parsed = resolveSchema.safeParse({
    requestId: formData.get("requestId"),
    status: formData.get("status"),
    resolution: formData.get("resolution"),
  });
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors as Record<string, string[]>;
    return fail(
      "VALIDATION_ERROR",
      Object.values(fields).flat()[0] ?? "Confira a resposta.",
      fields,
    );
  }

  const request = await loadOwnRequest(parsed.data.requestId, ctx.organizationId);
  if (!request) return fail("NOT_FOUND", "Pedido não encontrado.");
  if (request.kind === "deletion" && parsed.data.status === "fulfilled") {
    return fail(
      "VALIDATION_ERROR",
      "Pedido de exclusão só é dado como atendido pela anonimização, logo abaixo.",
    );
  }

  const changed = await requestsRepo.transitionLgpdRequest({
    id: request.id,
    organizationId: ctx.organizationId,
    status: parsed.data.status,
    handledBy: ctx.userId,
    resolution: parsed.data.resolution,
  });
  if (!changed) return fail("CONFLICT", "Este pedido já foi concluído.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "LGPD_REQUEST_RESOLVED",
    entityType: "lgpd_request",
    entityId: request.id,
    metadata: { protocol: request.protocol, status: parsed.data.status },
  });
  await notifyRequester(request, parsed.data.status);

  revalidatePath(QUEUE_PATH);
  return ok(undefined as never);
}

const anonymizeSchema = z.object({
  requestId: z.string().uuid(),
  confirmation: z.string().trim(),
});

/**
 * Executa a exclusão pedida (anonimização — ver `services/lgpd-erasure.ts`).
 *
 * Travas, todas no servidor:
 *   - só a partir de um pedido de exclusão aberto, nunca "por fora";
 *   - carência de 7 dias desde o pedido, para o titular poder desistir;
 *   - confirmação digitada;
 *   - ninguém anonimiza a própria conta.
 */
export async function anonymizeFromRequestAction(
  _prev: ActionResult<{ warnings: string[] }> | null,
  formData: FormData,
): Promise<ActionResult<{ warnings: string[] }>> {
  const ctx = await requireRole(["admin"]);
  const parsed = anonymizeSchema.safeParse({
    requestId: formData.get("requestId"),
    confirmation: formData.get("confirmation"),
  });
  if (!parsed.success) return fail("VALIDATION_ERROR", "Pedido inválido.");
  if (parsed.data.confirmation !== ANONYMIZE_CONFIRMATION) {
    return fail("VALIDATION_ERROR", `Digite ${ANONYMIZE_CONFIRMATION} para confirmar.`, {
      confirmation: [`Digite ${ANONYMIZE_CONFIRMATION}, em maiúsculas.`],
    });
  }

  const request = await loadOwnRequest(parsed.data.requestId, ctx.organizationId);
  if (!request || request.kind !== "deletion" || !request.requesterId) {
    return fail("NOT_FOUND", "Pedido de exclusão não encontrado.");
  }
  if (!OPEN_STATUSES.includes(request.status)) {
    return fail("CONFLICT", "Este pedido já foi concluído.");
  }
  if (request.requesterId === ctx.userId) {
    return fail(
      "FORBIDDEN",
      "Outra pessoa da coordenação precisa executar a sua exclusão.",
    );
  }
  const availableAt = deletionAvailableAt(request.createdAt);
  if (availableAt.getTime() > Date.now()) {
    return fail(
      "CONFLICT",
      `A carência de ${DELETION_GRACE_DAYS} dias termina em ${formatDate(availableAt.toISOString())}. Até lá o titular pode desistir.`,
    );
  }

  const result = await anonymizeUser(request.requesterId);
  if (!result.ok) return fail("CONFLICT", result.message);

  // Login ainda pendente: o pedido fica aberto para a nova tentativa concluir.
  if (!result.complete) {
    revalidatePath(QUEUE_PATH);
    return ok({ warnings: result.warnings });
  }

  await requestsRepo.transitionLgpdRequest({
    id: request.id,
    organizationId: ctx.organizationId,
    status: "fulfilled",
    handledBy: ctx.userId,
    resolution: `Dados de identificação eliminados em ${formatDate(new Date().toISOString())}. Registros com guarda legal foram mantidos sem identificação.`,
  });

  // O log fica, sem o nome: `actor` é quem executou; o alvo é só o id.
  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "LGPD_ANONYMIZED",
    entityType: "profile",
    entityId: request.requesterId,
    metadata: { protocol: request.protocol },
  });

  revalidatePath(QUEUE_PATH);
  revalidatePath(`${ADMIN_BASE}/usuarios`);
  return ok({ warnings: result.warnings });
}
