"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit";
import { isStripeConfigured } from "@/lib/stripe/client";
import { archivePlanOnStripe, syncPlanToStripe } from "@/lib/stripe/plans";
import {
  createStudentPlan,
  getStudentPlan,
  listStudentPlans,
  reorderStudentPlans,
  setStudentPlanActive,
  updateStudentPlan,
} from "@/repositories/student-plans";
import { planFieldsFromFormData, studentPlanSchema } from "@/schemas/student-plans";
import { fail, ok, type ActionResult } from "@/types/action-result";

const PAGE = "/admin/planos-de-alunos";

/**
 * Ações da área de planos.
 *
 * Regra que atravessa o arquivo: **o banco é salvo primeiro, a Stripe
 * depois**. A Stripe pode estar fora do ar, ou a chave pode estar errada — em
 * nenhum desses casos o admin deveria perder o que digitou. O plano nasce em
 * `draft`, e `sync_status` é o que conta a verdade sobre o espelhamento.
 */

/**
 * Sincroniza um plano recém-salvo, traduzindo os motivos de "não deu" numa
 * mensagem que o admin consiga agir sobre.
 */
async function syncAfterSave(
  planId: string,
  organizationId: string,
): Promise<Omit<PlanSaveResult, "planId">> {
  if (!isStripeConfigured()) {
    return {
      synced: false,
      syncMessage:
        "Plano salvo como rascunho: a Stripe ainda não está configurada neste ambiente.",
    };
  }

  const plan = await getStudentPlan(planId, organizationId);
  if (!plan) return { synced: false, syncMessage: "Plano não encontrado após salvar." };

  const result = await syncPlanToStripe(plan, plan.stripePaymentLinkId);
  return result.success
    ? { synced: true, paymentLinkUrl: result.paymentLinkUrl ?? null }
    : { synced: false, syncMessage: result.message };
}

export interface PlanSaveResult {
  planId: string;
  /** `false` quando o plano ficou salvo mas não chegou à Stripe. */
  synced: boolean;
  /** Motivo da falha de sincronização, para a UI mostrar sem esconder o sucesso parcial. */
  syncMessage?: string;
  paymentLinkUrl?: string | null;
}

export async function createPlanAction(
  _prev: ActionResult<PlanSaveResult> | null,
  formData: FormData,
): Promise<ActionResult<PlanSaveResult>> {
  const ctx = await requireRole(["admin"]);

  const parsed = studentPlanSchema.safeParse(planFieldsFromFormData(formData));
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const created = await createStudentPlan(parsed.data, ctx.organizationId, ctx.userId);
  if (!created.success) return fail("INTERNAL_ERROR", created.message);

  const sync = await syncAfterSave(created.plan.id, ctx.organizationId);

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "STUDENT_PLAN_CREATE",
    entityType: "student_plan",
    entityId: created.plan.id,
    metadata: { name: parsed.data.name, priceCents: parsed.data.priceCents },
  });

  revalidatePath(PAGE);
  revalidatePath("/planos");
  return ok({ planId: created.plan.id, ...sync });
}

export async function updatePlanAction(
  planId: string,
  _prev: ActionResult<PlanSaveResult> | null,
  formData: FormData,
): Promise<ActionResult<PlanSaveResult>> {
  const ctx = await requireRole(["admin"]);

  const parsed = studentPlanSchema.safeParse(planFieldsFromFormData(formData));
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const updated = await updateStudentPlan(planId, parsed.data, ctx.organizationId);
  if (!updated.success) return fail("INTERNAL_ERROR", updated.message);

  const sync = await syncAfterSave(planId, ctx.organizationId);

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "STUDENT_PLAN_UPDATE",
    entityType: "student_plan",
    entityId: planId,
    metadata: { name: parsed.data.name, priceCents: parsed.data.priceCents },
  });

  revalidatePath(PAGE);
  revalidatePath("/planos");
  return ok({ planId, ...sync });
}

/** Reprocessa um plano que ficou em `draft` ou `error`. */
export async function syncPlanAction(planId: string): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);
  const sync = await syncAfterSave(planId, ctx.organizationId);

  revalidatePath(PAGE);
  revalidatePath("/planos");

  return sync.synced
    ? ok(undefined as never)
    : fail("INTERNAL_ERROR", sync.syncMessage ?? "Falha ao sincronizar.");
}

export async function setPlanActiveAction(
  planId: string,
  isActive: boolean,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);

  const plan = await getStudentPlan(planId, ctx.organizationId);
  if (!plan) return fail("NOT_FOUND", "Plano não encontrado.");

  const done = await setStudentPlanActive(planId, isActive, ctx.organizationId);
  if (!done) return fail("INTERNAL_ERROR", "Falha ao alterar o plano.");

  // Espelhar na Stripe é o passo que impede um link já enviado de continuar
  // cobrando um plano que o admin acabou de tirar do ar.
  if (!isActive && isStripeConfigured()) {
    await archivePlanOnStripe(plan);
  }
  if (isActive) await syncAfterSave(planId, ctx.organizationId);

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: isActive ? "STUDENT_PLAN_ACTIVATE" : "STUDENT_PLAN_ARCHIVE",
    entityType: "student_plan",
    entityId: planId,
  });

  revalidatePath(PAGE);
  revalidatePath("/planos");
  return ok(undefined as never);
}

/** Reordenação da vitrine — a ordem que o aluno vê é a que o admin arrastou. */
export async function reorderPlansAction(
  order: { id: string; sortOrder: number }[],
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);

  const plans = await listStudentPlans(ctx.organizationId);
  const known = new Set(plans.map((p) => p.id));
  // Ids desconhecidos só chegariam aqui num payload forjado — a query já
  // filtra por organização, mas recusar cedo evita escrita inútil.
  if (order.some((item) => !known.has(item.id))) {
    return fail("VALIDATION_ERROR", "Ordem inválida.");
  }

  const done = await reorderStudentPlans(order, ctx.organizationId);
  if (!done) return fail("INTERNAL_ERROR", "Falha ao salvar a ordem.");

  revalidatePath(PAGE);
  revalidatePath("/planos");
  return ok(undefined as never);
}
