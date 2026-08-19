"use server";

import { requireRole, getSessionContext } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit";
import { isStripeConfigured, stripeErrorMessage } from "@/lib/stripe/client";
import { canCollectPayments } from "@/lib/stripe/connect";
import { createBillingPortalSession, createCheckoutSession } from "@/lib/stripe/checkout";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getConnectAccount } from "@/repositories/stripe-connect";
import { getStudentPlan } from "@/repositories/student-plans";
import { findStripeCustomerId } from "@/repositories/student-subscriptions";
import { fail, ok, type ActionResult } from "@/types/action-result";

/**
 * O aluno assinando sozinho.
 *
 * As duas ações devolvem uma URL da Stripe em vez de redirecionar no
 * servidor: `redirect()` dentro de Server Action para um domínio externo
 * atravessa a navegação do Next e perde o estado de carregamento do botão. O
 * cliente recebe a URL e troca de página.
 */

/**
 * "Ver como aluno" é somente leitura em toda a plataforma (§8.1), e cobrança
 * é o lugar onde isso mais importa: um admin explorando a vitrine não pode
 * abrir um checkout real no cartão de ninguém.
 */
function blockedInViewAs(isViewAs: boolean): ActionResult<never> | null {
  return isViewAs
    ? fail("READ_ONLY_MODE", "O modo \"ver como\" é somente leitura — nada é cobrado aqui.")
    : null;
}

export async function startPlanCheckoutAction(
  planId: string,
): Promise<ActionResult<{ url: string }>> {
  const ctx = await requireRole(["student"]);

  const blocked = blockedInViewAs(ctx.isViewAs);
  if (blocked) return blocked;

  if (!isStripeConfigured()) {
    return fail("INTERNAL_ERROR", "Pagamentos ainda não estão disponíveis.");
  }

  const plan = await getStudentPlan(planId, ctx.organizationId);
  if (!plan || !plan.isActive || !plan.isPublic || !plan.stripePriceId) {
    return fail("NOT_FOUND", "Este plano não está disponível.");
  }

  const account = await getConnectAccount(ctx.organizationId);
  if (!canCollectPayments(account)) {
    return fail("INTERNAL_ERROR", "A escola ainda não habilitou os pagamentos.");
  }

  const admin = createAdminSupabaseClient();

  // Vaga esgotada é a última checagem antes da Stripe: o teto é comercial e
  // pode ter sido atingido entre o render da vitrine e o clique.
  if (plan.seatLimit !== null) {
    const { count } = await admin
      .from("student_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", plan.id)
      .in("status", ["active", "trialing", "past_due"]);

    if ((count ?? 0) >= plan.seatLimit) {
      return fail("CONFLICT", "As vagas deste plano se esgotaram.");
    }
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", ctx.userId)
    .single();

  try {
    const url = await createCheckoutSession({
      plan,
      account: account!,
      studentId: ctx.userId,
      studentName: profile?.full_name ?? "Aluno",
      studentEmail: profile?.email ?? ctx.email,
      organizationId: ctx.organizationId,
    });

    await auditLog({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      actorRole: ctx.realRole,
      action: "SUBSCRIPTION_CHECKOUT_START",
      entityType: "student_plan",
      entityId: plan.id,
    });

    return ok({ url });
  } catch (error) {
    return fail("INTERNAL_ERROR", stripeErrorMessage(error));
  }
}

/**
 * Portal de faturas. Aberto tanto pelo aluno quanto pelo admin em nome dele —
 * daí o `getSessionContext` cru em vez de `requireRole(["student"])`.
 */
export async function openBillingPortalAction(): Promise<ActionResult<{ url: string }>> {
  const ctx = await getSessionContext();
  if (!ctx) return fail("UNAUTHENTICATED", "Sessão expirada.");

  const blocked = blockedInViewAs(ctx.isViewAs);
  if (blocked) return blocked;

  if (!isStripeConfigured()) {
    return fail("INTERNAL_ERROR", "Pagamentos ainda não estão disponíveis.");
  }

  const customerId = await findStripeCustomerId(ctx.userId);
  if (!customerId) return fail("NOT_FOUND", "Nenhuma assinatura encontrada.");

  const account = await getConnectAccount(ctx.organizationId);
  if (!account) return fail("NOT_FOUND", "A escola ainda não conectou uma conta Stripe.");

  try {
    return ok({ url: await createBillingPortalSession(customerId, account) });
  } catch (error) {
    return fail("INTERNAL_ERROR", stripeErrorMessage(error));
  }
}
