import "server-only";
import type Stripe from "stripe";
import { env } from "@/lib/env";
import { getStripe, stripeErrorMessage } from "@/lib/stripe/client";
import { markSyncError, saveStripeMirror, type StudentPlan } from "@/repositories/student-plans";
import type { ConnectAccount } from "@/repositories/stripe-connect";
import type { PlanInterval } from "@/schemas/student-plans";

/**
 * Espelhamento de um plano do catálogo em Product + Price + Payment Link na
 * Stripe.
 *
 * A regra que organiza este arquivo: **Price na Stripe é imutável**. Reajustar
 * um plano não edita o preço, cria outro e arquiva o anterior — quem já assina
 * continua preso ao Price antigo (que é o correto: o contrato dele não mudou)
 * e só as assinaturas novas pegam o valor novo. Product, esse sim, é editado
 * no lugar, para nome e descrição não se multiplicarem no dashboard.
 */

/**
 * Trimestral e semestral não existem na Stripe. Viram `month` com
 * `interval_count`, que é como a Stripe cobra de 3 em 3 meses de verdade.
 */
function recurringFor(
  interval: PlanInterval,
): Stripe.PriceCreateParams.Recurring | undefined {
  switch (interval) {
    case "month":
      return { interval: "month", interval_count: 1 };
    case "quarter":
      return { interval: "month", interval_count: 3 };
    case "semester":
      return { interval: "month", interval_count: 6 };
    case "year":
      return { interval: "year", interval_count: 1 };
    case "one_time":
      return undefined;
  }
}

/** Contexto do Connect: no modelo `direct` tudo é criado na conta conectada. */
function requestOptions(account: ConnectAccount): Stripe.RequestOptions {
  return account.chargeModel === "direct"
    ? { stripeAccount: account.stripeAccountId }
    : {};
}

/**
 * Parâmetros de repasse de uma assinatura. Só existem no modelo
 * `destination`: em `direct` a cobrança já nasce na conta da escola e não há
 * nada a transferir — passar `transfer_data` ali seria erro da API.
 *
 * `on_behalf_of` faz a conta conectada ser a *settlement merchant*: é o nome
 * dela que aparece na fatura do cartão do aluno, e é o país dela que define a
 * moeda de liquidação.
 */
export function connectSubscriptionData(
  account: ConnectAccount,
): Pick<
  Stripe.Checkout.SessionCreateParams.SubscriptionData,
  "transfer_data" | "application_fee_percent" | "on_behalf_of"
> {
  if (account.chargeModel === "direct") {
    return account.applicationFeePercent > 0
      ? { application_fee_percent: account.applicationFeePercent }
      : {};
  }

  return {
    transfer_data: { destination: account.stripeAccountId },
    on_behalf_of: account.stripeAccountId,
    ...(account.applicationFeePercent > 0
      ? { application_fee_percent: account.applicationFeePercent }
      : {}),
  };
}

/** Metadata que amarra os objetos da Stripe de volta ao nosso domínio. */
function planMetadata(plan: StudentPlan): Record<string, string> {
  return {
    plan_id: plan.id,
    organization_id: plan.organizationId,
    platform: "du-ingles",
  };
}

async function ensureProduct(
  plan: StudentPlan,
  options: Stripe.RequestOptions,
): Promise<Stripe.Product> {
  const stripe = getStripe();
  const payload = {
    name: plan.name,
    description: plan.description ?? plan.headline ?? undefined,
    metadata: planMetadata(plan),
  };

  if (plan.stripeProductId) {
    try {
      return await stripe.products.update(plan.stripeProductId, payload, options);
    } catch {
      // Produto apagado no dashboard, ou id de outro ambiente (sandbox →
      // produção). Recriar é melhor do que travar o plano para sempre.
    }
  }

  return stripe.products.create(payload, options);
}

/**
 * Devolve o Price a usar, criando um novo só quando o valor ou a
 * periodicidade mudaram. Sem essa checagem, salvar o plano sem mexer no preço
 * geraria um Price novo a cada clique em "Salvar".
 */
async function ensurePrice(
  plan: StudentPlan,
  product: Stripe.Product,
  options: Stripe.RequestOptions,
): Promise<Stripe.Price> {
  const stripe = getStripe();
  const recurring = recurringFor(plan.billingInterval);

  if (plan.stripePriceId) {
    try {
      const current = await stripe.prices.retrieve(plan.stripePriceId, undefined, options);
      const sameAmount = current.unit_amount === plan.priceCents;
      const sameInterval =
        current.recurring?.interval === recurring?.interval &&
        (current.recurring?.interval_count ?? null) === (recurring?.interval_count ?? null);

      if (current.active && sameAmount && sameInterval) return current;

      // Preço mudou: arquiva o antigo para ele sumir do dashboard como opção
      // de venda, mas sem tocar em quem já assina por ele.
      if (current.active) {
        await stripe.prices.update(plan.stripePriceId, { active: false }, options);
      }
    } catch {
      // Idem ao produto: id órfão não pode paralisar o plano.
    }
  }

  return stripe.prices.create(
    {
      product: product.id,
      currency: plan.currency,
      unit_amount: plan.priceCents,
      ...(recurring ? { recurring } : {}),
      metadata: planMetadata(plan),
    },
    options,
  );
}

/**
 * Link de pagamento pronto para o admin mandar por WhatsApp.
 *
 * O link não sabe quem é o aluno — quem o abre pode ser qualquer pessoa. Por
 * isso ele exige e-mail no checkout, e é por esse e-mail que o webhook liga a
 * assinatura ao perfil do aluno. Quando o aluno assina pela própria
 * plataforma, o caminho é outro (`checkout.ts`) e o vínculo vem do id da
 * sessão, que é bem mais seguro.
 */
async function ensurePaymentLink(
  plan: StudentPlan,
  price: Stripe.Price,
  account: ConnectAccount,
  options: Stripe.RequestOptions,
): Promise<Stripe.PaymentLink | null> {
  const stripe = getStripe();
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const isRecurring = Boolean(price.recurring);

  const params: Stripe.PaymentLinkCreateParams = {
    line_items: [{ price: price.id, quantity: 1 }],
    metadata: planMetadata(plan),
    after_completion: {
      type: "redirect",
      redirect: { url: `${base}/planos?assinatura=confirmada` },
    },
    // Sem e-mail não há como ligar o pagamento a um aluno depois.
    customer_creation: isRecurring ? undefined : "always",
    allow_promotion_codes: true,
  };

  if (account.chargeModel === "destination") {
    params.transfer_data = { destination: account.stripeAccountId };
    params.on_behalf_of = account.stripeAccountId;
  }

  if (isRecurring) {
    params.subscription_data = { metadata: planMetadata(plan) };
    // A Stripe só aceita comissão percentual em link recorrente; em link
    // avulso ela teria de ser `application_fee_amount`, em centavos.
    if (account.applicationFeePercent > 0) {
      params.application_fee_percent = account.applicationFeePercent;
    }
  } else if (account.applicationFeePercent > 0) {
    params.application_fee_amount = Math.round(
      (plan.priceCents * account.applicationFeePercent) / 100,
    );
  }

  try {
    return await stripe.paymentLinks.create(params, options);
  } catch (error) {
    // O link é conveniência: sem ele o plano ainda é vendável pela vitrine.
    // Melhor um plano sincronizado sem link do que um plano em erro.
    console.error("[stripe] falha ao criar payment link:", error);
    return null;
  }
}

/**
 * Desativa o payment link anterior. Um link antigo continua cobrando o preço
 * antigo para sempre — e um reajuste que deixasse o link velho no ar seria
 * uma torneira aberta.
 */
async function deactivatePaymentLink(
  paymentLinkId: string | null,
  options: Stripe.RequestOptions,
): Promise<void> {
  if (!paymentLinkId) return;
  try {
    await getStripe().paymentLinks.update(paymentLinkId, { active: false }, options);
  } catch {
    // Link já apagado no dashboard: nada a fazer.
  }
}

export interface SyncResult {
  success: boolean;
  message?: string;
  paymentLinkUrl?: string | null;
}

/**
 * Espelha o plano inteiro na Stripe e grava o resultado. É o único ponto que
 * escreve `sync_status`: sucesso e falha saem daqui, então o admin nunca vê
 * um plano "sincronizado" cujo Price não existe.
 */
export async function syncPlanToStripe(
  plan: StudentPlan,
  account: ConnectAccount,
  previousPaymentLinkId: string | null,
): Promise<SyncResult> {
  const options = requestOptions(account);

  try {
    const product = await ensureProduct(plan, options);
    const price = await ensurePrice(plan, product, options);

    // Só troca o link quando o preço de fato mudou — recriar a cada salvamento
    // invalidaria links que o admin já mandou para alunos.
    const priceChanged = price.id !== plan.stripePriceId;
    let paymentLink: Stripe.PaymentLink | null = null;

    if (priceChanged || !plan.stripePaymentLinkUrl) {
      await deactivatePaymentLink(previousPaymentLinkId, options);
      paymentLink = await ensurePaymentLink(plan, price, account, options);
    }

    await saveStripeMirror(plan.id, {
      productId: product.id,
      priceId: price.id,
      paymentLinkId: paymentLink?.id ?? (priceChanged ? null : previousPaymentLinkId),
      paymentLinkUrl: paymentLink?.url ?? (priceChanged ? null : plan.stripePaymentLinkUrl),
    });

    return { success: true, paymentLinkUrl: paymentLink?.url ?? plan.stripePaymentLinkUrl };
  } catch (error) {
    const message = stripeErrorMessage(error);
    await markSyncError(plan.id, message);
    return { success: false, message };
  }
}

/**
 * Arquiva o espelho na Stripe quando o plano é arquivado no painel. Produto
 * inativo some da vitrine da Stripe sem invalidar as assinaturas vigentes —
 * apagar de verdade seria impossível justamente por causa delas.
 */
export async function archivePlanOnStripe(
  plan: StudentPlan,
  account: ConnectAccount,
): Promise<void> {
  const options = requestOptions(account);
  const stripe = getStripe();

  try {
    if (plan.stripePriceId) {
      await stripe.prices.update(plan.stripePriceId, { active: false }, options);
    }
    if (plan.stripeProductId) {
      await stripe.products.update(plan.stripeProductId, { active: false }, options);
    }
    // O link é o que mais importa desativar: um plano arquivado no painel mas
    // com link vivo continuaria cobrando quem recebeu a mensagem semana
    // passada.
    await deactivatePaymentLink(plan.stripePaymentLinkId, options);
  } catch (error) {
    // Arquivar no nosso banco já tirou o plano de venda; a Stripe ficar
    // dessincronizada aqui não pode impedir o admin de arquivar.
    console.error("[stripe] falha ao arquivar plano:", error);
  }
}
