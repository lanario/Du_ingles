"use server";

import { requireRole, getSessionContext } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit";
import { getStripe, isStripeConfigured, stripeErrorMessage } from "@/lib/stripe/client";
import { createBillingPortalSession, createCheckoutSession } from "@/lib/stripe/checkout";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getStudentPlan } from "@/repositories/student-plans";
import {
  findStripeCustomerId,
  getActiveSubscriptionFor,
} from "@/repositories/student-subscriptions";
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
    ? fail("READ_ONLY_MODE", 'O modo "ver como" é somente leitura — nada é cobrado aqui.')
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

  const admin = createAdminSupabaseClient();

  // Autocadastros têm uma única experiência grátis de 7 dias. Se o primeiro
  // checkout falhou ou foi fechado, o aluno ainda pode concluí-lo aqui; uma
  // assinatura anterior impede abrir outro período de teste.
  const { data: registration } = await admin
    .from("student_registrations")
    .select("profile_id, requested_plan_id, stripe_checkout_session_id")
    .eq("profile_id", ctx.userId)
    .maybeSingle();
  let trialDaysOverride: number | undefined;
  let existingSubscriptionCount = 0;
  if (registration) {
    const { count } = await admin
      .from("student_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("student_id", ctx.userId);
    existingSubscriptionCount = count ?? 0;
    trialDaysOverride = existingSubscriptionCount > 0 ? 0 : 7;

    if (registration.stripe_checkout_session_id) {
      try {
        const session = await getStripe().checkout.sessions.retrieve(
          registration.stripe_checkout_session_id,
        );
        if (session.status === "complete" && existingSubscriptionCount === 0) {
          return ok({ url: session.success_url ?? "/planos?assinatura=confirmada" });
        }
        if (session.status === "open") {
          if (registration.requested_plan_id === plan.id && session.url) {
            return ok({ url: session.url });
          }
          await getStripe().checkout.sessions.expire(session.id);
        }
      } catch (error) {
        return fail("INTERNAL_ERROR", stripeErrorMessage(error));
      }
    }
  }

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
      studentId: ctx.userId,
      studentName: profile?.full_name ?? "Aluno",
      studentEmail: profile?.email ?? ctx.email,
      organizationId: ctx.organizationId,
      ...(trialDaysOverride === undefined ? {} : { trialDaysOverride }),
      onCustomerReady: async (stripeCustomerId) => {
        const { error } = await admin
          .from("student_registrations")
          .update({ stripe_customer_id: stripeCustomerId })
          .eq("profile_id", ctx.userId);
        if (error) throw error;
      },
      onSessionCreated: async (stripeCheckoutSessionId) => {
        const { error } = await admin
          .from("student_registrations")
          .update({
            requested_plan_id: plan.id,
            stripe_checkout_session_id: stripeCheckoutSessionId,
          })
          .eq("profile_id", ctx.userId);
        if (error) throw error;
      },
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

  try {
    return ok({ url: await createBillingPortalSession(customerId) });
  } catch (error) {
    return fail("INTERNAL_ERROR", stripeErrorMessage(error));
  }
}

/**
 * Cancela a experiência sem cobrança. O cancelamento fica agendado para o fim
 * do teste, então o aluno mantém o acesso durante os dias que ainda restam.
 */
export async function cancelStudentTrialAction(): Promise<ActionResult<never>> {
  const ctx = await requireRole(["student"]);
  if (ctx.isViewAs) return fail("READ_ONLY_MODE", 'O modo "ver como" é somente leitura.');
  if (!isStripeConfigured()) {
    return fail("INTERNAL_ERROR", "Pagamentos ainda não estão disponíveis.");
  }

  const subscription = await getActiveSubscriptionFor(ctx.userId);
  if (
    !subscription ||
    subscription.status !== "trialing" ||
    !subscription.stripeSubscriptionId
  ) {
    return fail("CONFLICT", "Não encontramos uma experiência ativa para cancelar.");
  }
  if (subscription.cancelAtPeriodEnd) return ok(undefined as never);
  if (subscription.trialEnd && new Date(subscription.trialEnd).getTime() <= Date.now()) {
    return fail("CONFLICT", "O período de experiência já terminou.");
  }

  try {
    await getStripe().subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
    return ok(undefined as never);
  } catch (error) {
    return fail("INTERNAL_ERROR", stripeErrorMessage(error));
  }
}
