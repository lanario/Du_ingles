import "server-only";
import type Stripe from "stripe";
import { env } from "@/lib/env";
import { getStripe, stripeErrorMessage } from "@/lib/stripe/client";
import {
  markSyncError,
  saveStripeMirror,
  type StudentPlan,
} from "@/repositories/student-plans";
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
 *
 * Tudo aqui roda na conta Stripe única da plataforma — sem Connect, sem
 * `stripeAccount` por request.
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

/** Metadata que amarra os objetos da Stripe de volta ao nosso domínio. */
function planMetadata(plan: StudentPlan): Record<string, string> {
  return {
    plan_id: plan.id,
    organization_id: plan.organizationId,
    platform: "du-ingles",
  };
}

async function ensureProduct(plan: StudentPlan): Promise<Stripe.Product> {
  const stripe = getStripe();
  const payload = {
    name: plan.name,
    description: plan.description ?? plan.headline ?? undefined,
    metadata: planMetadata(plan),
  };

  if (plan.stripeProductId) {
    try {
      return await stripe.products.update(plan.stripeProductId, payload);
    } catch {
      // Produto apagado no dashboard, ou id de outro ambiente (sandbox →
      // produção). Recriar é melhor do que travar o plano para sempre.
    }
  }

  return stripe.products.create(payload);
}

/**
 * Devolve o Price a usar, criando um novo só quando o valor ou a
 * periodicidade mudaram. Sem essa checagem, salvar o plano sem mexer no preço
 * geraria um Price novo a cada clique em "Salvar".
 */
async function ensurePrice(
  plan: StudentPlan,
  product: Stripe.Product,
): Promise<Stripe.Price> {
  const stripe = getStripe();
  const recurring = recurringFor(plan.billingInterval);

  if (plan.stripePriceId) {
    try {
      const current = await stripe.prices.retrieve(plan.stripePriceId);
      const sameAmount = current.unit_amount === plan.priceCents;
      const sameInterval =
        current.recurring?.interval === recurring?.interval &&
        (current.recurring?.interval_count ?? null) ===
          (recurring?.interval_count ?? null);

      if (current.active && sameAmount && sameInterval) return current;

      // Preço mudou: arquiva o antigo para ele sumir do dashboard como opção
      // de venda, mas sem tocar em quem já assina por ele.
      if (current.active) {
        await stripe.prices.update(plan.stripePriceId, { active: false });
      }
    } catch {
      // Idem ao produto: id órfão não pode paralisar o plano.
    }
  }

  return stripe.prices.create({
    product: product.id,
    currency: plan.currency,
    unit_amount: plan.priceCents,
    ...(recurring ? { recurring } : {}),
    metadata: planMetadata(plan),
  });
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

  if (isRecurring) {
    params.subscription_data = { metadata: planMetadata(plan) };
  }

  try {
    return await stripe.paymentLinks.create(params);
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
async function deactivatePaymentLink(paymentLinkId: string | null): Promise<void> {
  if (!paymentLinkId) return;
  try {
    await getStripe().paymentLinks.update(paymentLinkId, { active: false });
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
  previousPaymentLinkId: string | null,
): Promise<SyncResult> {
  try {
    const product = await ensureProduct(plan);
    const price = await ensurePrice(plan, product);

    // Só troca o link quando o preço de fato mudou — recriar a cada salvamento
    // invalidaria links que o admin já mandou para alunos.
    const priceChanged = price.id !== plan.stripePriceId;
    let paymentLink: Stripe.PaymentLink | null = null;

    if (priceChanged || !plan.stripePaymentLinkUrl) {
      await deactivatePaymentLink(previousPaymentLinkId);
      paymentLink = await ensurePaymentLink(plan, price);
    }

    await saveStripeMirror(plan.id, {
      productId: product.id,
      priceId: price.id,
      paymentLinkId: paymentLink?.id ?? (priceChanged ? null : previousPaymentLinkId),
      paymentLinkUrl:
        paymentLink?.url ?? (priceChanged ? null : plan.stripePaymentLinkUrl),
    });

    return {
      success: true,
      paymentLinkUrl: paymentLink?.url ?? plan.stripePaymentLinkUrl,
    };
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
export async function archivePlanOnStripe(plan: StudentPlan): Promise<void> {
  const stripe = getStripe();

  try {
    if (plan.stripePriceId) {
      await stripe.prices.update(plan.stripePriceId, { active: false });
    }
    if (plan.stripeProductId) {
      await stripe.products.update(plan.stripeProductId, { active: false });
    }
    // O link é o que mais importa desativar: um plano arquivado no painel mas
    // com link vivo continuaria cobrando quem recebeu a mensagem semana
    // passada.
    await deactivatePaymentLink(plan.stripePaymentLinkId);
  } catch (error) {
    // Arquivar no nosso banco já tirou o plano de venda; a Stripe ficar
    // dessincronizada aqui não pode impedir o admin de arquivar.
    console.error("[stripe] falha ao arquivar plano:", error);
  }
}
