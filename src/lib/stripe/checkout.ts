import "server-only";
import type Stripe from "stripe";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe/client";
import { connectSubscriptionData } from "@/lib/stripe/plans";
import { findStripeCustomerId } from "@/repositories/student-subscriptions";
import type { ConnectAccount } from "@/repositories/stripe-connect";
import type { StudentPlan } from "@/repositories/student-plans";

/**
 * Checkout do aluno assinando pela própria plataforma.
 *
 * A diferença crucial para o payment link do admin é o vínculo: aqui a sessão
 * carrega `student_id` na metadata, então o webhook sabe exatamente de quem é
 * a assinatura — sem depender de o aluno digitar no checkout o mesmo e-mail
 * que usa para entrar na plataforma.
 */

function urls(planId: string) {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  return {
    // `{CHECKOUT_SESSION_ID}` é substituído pela Stripe no redirect. A tela de
    // sucesso não confirma nada sozinha — quem confirma é o webhook; ela só
    // mostra o estado enquanto o evento não chega.
    success: `${base}/planos?assinatura=confirmada&session={CHECKOUT_SESSION_ID}`,
    cancel: `${base}/planos?assinatura=cancelada&plano=${planId}`,
  };
}

/**
 * Reaproveita o Customer que o aluno já tem, ou cria um. Um Customer por
 * aluno é o que faz o portal de faturas mostrar o histórico completo — com
 * Customers duplicados, cada assinatura viveria numa ilha.
 */
async function ensureCustomer(
  studentId: string,
  studentName: string,
  studentEmail: string,
  organizationId: string,
  options: Stripe.RequestOptions,
): Promise<string> {
  const existing = await findStripeCustomerId(studentId);
  if (existing) return existing;

  const customer = await getStripe().customers.create(
    {
      email: studentEmail,
      name: studentName,
      metadata: {
        student_id: studentId,
        organization_id: organizationId,
        platform: "du-ingles",
      },
    },
    options,
  );
  return customer.id;
}

export interface CheckoutInput {
  plan: StudentPlan;
  account: ConnectAccount;
  studentId: string;
  studentName: string;
  studentEmail: string;
  organizationId: string;
}

/**
 * Cria a sessão de checkout e devolve a URL hospedada pela Stripe.
 *
 * Em `destination` a sessão nasce na conta plataforma (nenhum `stripeAccount`
 * nas opções) e o repasse vai em `subscription_data.transfer_data` — é isso
 * que mantém Customers, faturas e disputas todos sob a conta da plataforma.
 * Em `direct` a sessão inteira roda na conta conectada.
 */
export async function createCheckoutSession(input: CheckoutInput): Promise<string> {
  const { plan, account } = input;
  const options: Stripe.RequestOptions =
    account.chargeModel === "direct" ? { stripeAccount: account.stripeAccountId } : {};

  if (!plan.stripePriceId) {
    throw new Error("Plano ainda não sincronizado com a Stripe.");
  }

  const customerId = await ensureCustomer(
    input.studentId,
    input.studentName,
    input.studentEmail,
    input.organizationId,
    options,
  );

  const { success, cancel } = urls(plan.id);
  const isRecurring = plan.billingInterval !== "one_time";

  const metadata: Record<string, string> = {
    plan_id: plan.id,
    student_id: input.studentId,
    organization_id: input.organizationId,
    platform: "du-ingles",
  };

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: isRecurring ? "subscription" : "payment",
    customer: customerId,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: success,
    cancel_url: cancel,
    locale: "pt-BR",
    allow_promotion_codes: true,
    metadata,
  };

  if (isRecurring) {
    params.subscription_data = {
      metadata,
      ...(plan.trialDays > 0 ? { trial_period_days: plan.trialDays } : {}),
      ...connectSubscriptionData(account),
    };
  } else {
    params.payment_intent_data = {
      metadata,
      ...(account.chargeModel === "destination"
        ? {
            transfer_data: { destination: account.stripeAccountId },
            on_behalf_of: account.stripeAccountId,
          }
        : {}),
      ...(account.applicationFeePercent > 0
        ? {
            // Cobrança avulsa exige a comissão em centavos, não em percentual.
            application_fee_amount: Math.round(
              (plan.priceCents * account.applicationFeePercent) / 100,
            ),
          }
        : {}),
    };
  }

  const session = await getStripe().checkout.sessions.create(params, options);
  if (!session.url) throw new Error("A Stripe não devolveu a URL do checkout.");
  return session.url;
}

/**
 * Portal de faturas da Stripe — onde o aluno troca o cartão, baixa recibos e
 * cancela sozinho. Construir essas telas à mão custaria semanas e ainda
 * obrigaria a plataforma a tocar em dado de cartão.
 */
export async function createBillingPortalSession(
  customerId: string,
  account: ConnectAccount,
): Promise<string> {
  const options: Stripe.RequestOptions =
    account.chargeModel === "direct" ? { stripeAccount: account.stripeAccountId } : {};

  const session = await getStripe().billingPortal.sessions.create(
    {
      customer: customerId,
      return_url: `${env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/planos`,
      locale: "pt-BR",
    },
    options,
  );
  return session.url;
}
