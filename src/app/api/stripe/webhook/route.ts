import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe, isStripeConfigured } from "@/lib/stripe/client";
import { requireStripeWebhookSecret } from "@/lib/env";
import { syncConnectAccountFromEvent } from "@/lib/stripe/connect";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getPlanByStripePriceId } from "@/repositories/student-plans";
import {
  attachLatestInvoice,
  upsertSubscription,
  type SubscriptionStatus,
} from "@/repositories/student-subscriptions";

/**
 * Webhook da Stripe — a única fonte de verdade sobre o estado de uma
 * assinatura.
 *
 * O redirect de sucesso do checkout não confirma nada: o aluno pode fechar o
 * navegador antes dele, e boleto/Pix levam horas ou dias para compensar. Quem
 * escreve `status` é sempre este arquivo, depois de verificar a assinatura
 * criptográfica do evento.
 *
 * Rota dinâmica e em runtime Node: a verificação da assinatura precisa do
 * corpo *cru*, byte a byte, e do `crypto` do Node.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Eventos que interessam. O resto é confirmado com 200 e descartado. */
const HANDLED = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "account.updated",
]);

function toIso(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

/**
 * A partir da API 2025-03, `current_period_*` deixou de existir na assinatura
 * e passou a viver em cada item — uma assinatura pode ter itens com ciclos
 * diferentes. Aqui só há um item por assinatura, então o primeiro item *é* o
 * ciclo; o fallback cobre assinaturas criadas em versões anteriores.
 */
function periodOf(subscription: Stripe.Subscription): {
  start: string | null;
  end: string | null;
} {
  const item = subscription.items?.data?.[0];
  const legacy = subscription as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  };
  return {
    start: toIso(item?.current_period_start ?? legacy.current_period_start),
    end: toIso(item?.current_period_end ?? legacy.current_period_end),
  };
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/**
 * Descobre de qual aluno é a assinatura.
 *
 * Caminho feliz: a metadata carrega `student_id`, porque a sessão nasceu na
 * plataforma. Caminho do payment link enviado pelo admin: a Stripe só conhece
 * o e-mail digitado no checkout, então casamos pelo e-mail do perfil. É por
 * isso que o link exige e-mail — sem ele o pagamento entra na Stripe sem dono
 * do lado de cá.
 */
async function resolveStudent(
  metadata: Stripe.Metadata | null | undefined,
  customerId: string | null,
  fallbackEmail: string | null,
): Promise<{ studentId: string; organizationId: string } | null> {
  const admin = createAdminSupabaseClient();
  const metaStudent = metadata?.["student_id"];

  if (metaStudent) {
    const { data } = await admin
      .from("profiles")
      .select("id, organization_id")
      .eq("id", metaStudent)
      .maybeSingle();
    if (data) return { studentId: data.id, organizationId: data.organization_id };
  }

  // Antes do e-mail, tenta o Customer: se ele já assinou uma vez, o vínculo
  // está gravado e é mais confiável do que qualquer string digitada.
  if (customerId) {
    const { data } = await admin
      .from("student_subscriptions")
      .select("student_id, organization_id")
      .eq("stripe_customer_id", customerId)
      .limit(1)
      .maybeSingle();
    if (data) return { studentId: data.student_id, organizationId: data.organization_id };
  }

  if (fallbackEmail) {
    const { data } = await admin
      .from("profiles")
      .select("id, organization_id")
      .eq("email", fallbackEmail.toLowerCase())
      .eq("role", "student")
      .is("deleted_at", null)
      .maybeSingle();
    if (data) return { studentId: data.id, organizationId: data.organization_id };
  }

  return null;
}

/** Grava (ou regrava) uma assinatura a partir do objeto completo da Stripe. */
async function persistSubscription(
  subscription: Stripe.Subscription,
  checkoutSessionId: string | null,
  fallbackEmail: string | null,
): Promise<void> {
  const customerId = idOf(subscription.customer);
  if (!customerId) return;

  const item = subscription.items?.data?.[0];
  const priceId = idOf(item?.price?.id ?? null);
  const plan = priceId ? await getPlanByStripePriceId(priceId) : null;

  const owner = await resolveStudent(subscription.metadata, customerId, fallbackEmail);
  if (!owner) {
    // Sem dono não há linha a criar: inventar um aluno seria pior do que
    // deixar o admin conciliar o pagamento na mão.
    console.error(
      `[stripe-webhook] assinatura ${subscription.id} sem aluno identificável.`,
    );
    return;
  }

  const period = periodOf(subscription);

  await upsertSubscription({
    organizationId: plan?.organizationId ?? owner.organizationId,
    studentId: owner.studentId,
    planId: plan?.id ?? null,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    stripeCheckoutSessionId: checkoutSessionId,
    status: subscription.status as SubscriptionStatus,
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
    cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
    canceledAt: toIso(subscription.canceled_at),
    trialEnd: toIso(subscription.trial_end),
    amountCents: item?.price?.unit_amount ?? plan?.priceCents ?? null,
    currency: subscription.currency ?? plan?.currency ?? "brl",
    hostedInvoiceUrl: null,
  });
}

export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe não configurada." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Assinatura ausente." }, { status: 400 });
  }

  // `request.text()` preserva o corpo exatamente como chegou. Qualquer
  // reserialização (JSON.parse → stringify) muda um byte e invalida o HMAC.
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(
      payload,
      signature,
      requireStripeWebhookSecret(),
    );
  } catch (error) {
    console.error("[stripe-webhook] assinatura inválida:", error);
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 400 });
  }

  if (!HANDLED.has(event.type)) {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const subscriptionId = idOf(session.subscription);
        if (!subscriptionId) break;

        // A sessão traz a assinatura só como id; o objeto completo é o que tem
        // status, ciclo e preço.
        const subscription = await getStripe().subscriptions.retrieve(
          subscriptionId,
          undefined,
          // Em `direct` a assinatura vive na conta conectada — sem este
          // contexto a busca devolveria 404.
          event.account ? { stripeAccount: event.account } : {},
        );

        // A metadata da sessão é mais rica que a da assinatura quando o
        // checkout veio da nossa plataforma.
        subscription.metadata = { ...subscription.metadata, ...session.metadata };

        await persistSubscription(
          subscription,
          session.id,
          session.customer_details?.email ?? session.customer_email ?? null,
        );
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await persistSubscription(event.data.object, null, null);
        break;
      }

      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | { id: string } | null;
        };
        const subscriptionId =
          idOf(invoice.subscription) ??
          idOf(invoice.lines?.data?.[0]?.parent?.subscription_item_details?.subscription);
        if (!subscriptionId) break;

        await attachLatestInvoice(subscriptionId, invoice.hosted_invoice_url ?? null);

        // Uma fatura falhada move a assinatura para `past_due`; reler o objeto
        // é mais barato do que deduzir a transição a partir do tipo do evento.
        const subscription = await getStripe().subscriptions.retrieve(
          subscriptionId,
          undefined,
          event.account ? { stripeAccount: event.account } : {},
        );
        await persistSubscription(subscription, null, invoice.customer_email ?? null);
        break;
      }

      case "account.updated": {
        await syncConnectAccountFromEvent(event.data.object);
        break;
      }
    }
  } catch (error) {
    // 500 faz a Stripe reentregar o evento com backoff. Como todo o caminho de
    // escrita é idempotente (`upsert` por id da Stripe), reentregar é seguro.
    console.error(`[stripe-webhook] falha ao processar ${event.type}:`, error);
    return NextResponse.json({ error: "Falha ao processar evento." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
