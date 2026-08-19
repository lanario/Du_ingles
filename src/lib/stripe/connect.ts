import "server-only";
import type Stripe from "stripe";
import { env } from "@/lib/env";
import { getStripe, isStripeLiveMode } from "@/lib/stripe/client";
import {
  getConnectAccount,
  upsertConnectAccount,
  type ConnectAccount,
} from "@/repositories/stripe-connect";

/**
 * Stripe Connect: a escola como *conta conectada* da plataforma Du Inglês.
 *
 * O desenho é o de uma plataforma multi-escola, mesmo com uma escola só hoje:
 * a conta da Du Inglês é a plataforma, cada organização é uma conta Express
 * conectada. Toda cobrança de aluno nasce na conta plataforma e transfere o
 * líquido para a conectada (`transfer_data.destination`) — é o modelo
 * *destination charges*, e é o que faz "todo pagamento ser gerenciado pela
 * minha conta" ser literalmente verdade: os Customers, as assinaturas, as
 * faturas e os dados de disputa ficam todos na plataforma.
 *
 * `direct` continua disponível por organização para o caso oposto (a escola
 * assumindo taxas e relação direta com a Stripe), e é por isso que o modelo é
 * coluna no banco e não constante aqui.
 */

/** Onde a Stripe devolve o admin depois do onboarding hospedado. */
function onboardingUrls() {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  return {
    // `refresh_url` é chamado quando o link expira (eles duram poucos
    // minutos) — precisa reiniciar o fluxo, não mostrar erro.
    refreshUrl: `${base}/admin/planos-de-alunos?connect=refresh`,
    returnUrl: `${base}/admin/planos-de-alunos?connect=retorno`,
  };
}

function toRequirements(account: Stripe.Account): Record<string, unknown> {
  return (account.requirements ?? {}) as unknown as Record<string, unknown>;
}

/** Traduz o objeto `Account` da Stripe para o formato que o banco guarda. */
function accountSnapshot(account: Stripe.Account, organizationId: string) {
  return {
    organizationId,
    stripeAccountId: account.id,
    chargesEnabled: account.charges_enabled ?? false,
    payoutsEnabled: account.payouts_enabled ?? false,
    detailsSubmitted: account.details_submitted ?? false,
    requirements: toRequirements(account),
    country: account.country ?? "BR",
    defaultCurrency: account.default_currency ?? "brl",
    businessName:
      account.business_profile?.name ?? account.settings?.dashboard?.display_name ?? null,
    livemode: isStripeLiveMode(),
  };
}

/**
 * Cria a conta conectada da organização, ou devolve a existente.
 *
 * Idempotente por organização — o `unique` em `organization_id` é a rede de
 * segurança, mas a checagem aqui evita chegar a criar a conta na Stripe: uma
 * conta Express órfã não pode ser apagada depois que recebeu qualquer
 * pagamento, então é melhor nunca criá-la duas vezes.
 */
export async function ensureConnectAccount(
  organizationId: string,
  organizationName: string,
  adminEmail: string,
): Promise<ConnectAccount> {
  const existing = await getConnectAccount(organizationId);
  if (existing) return existing;

  const stripe = getStripe();
  const account = await stripe.accounts.create({
    type: "express",
    country: "BR",
    email: adminEmail,
    business_profile: {
      name: organizationName,
      // MCC de escolas e serviços educacionais — a Stripe usa isto na análise
      // de risco; deixar em branco atrasa a liberação da conta.
      mcc: "8299",
      url: env.NEXT_PUBLIC_SITE_URL,
    },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    settings: {
      payouts: {
        // Repasse automático: a escola não deveria precisar abrir o dashboard
        // da Stripe para receber o que já foi cobrado.
        schedule: { interval: "daily" },
      },
    },
    // O webhook `account.updated` chega sem contexto nenhum do nosso domínio;
    // a metadata é o que permite achar a organização sem uma query por id.
    metadata: { organization_id: organizationId, platform: "du-ingles" },
  });

  const saved = await upsertConnectAccount(accountSnapshot(account, organizationId));
  if (!saved) throw new Error("Conta criada na Stripe, mas não foi possível salvá-la.");
  return saved;
}

/**
 * Link de onboarding hospedado pela Stripe. Expira em minutos e é de uso
 * único — por isso é gerado sob demanda a cada clique, nunca guardado.
 */
export async function createOnboardingLink(stripeAccountId: string): Promise<string> {
  const { refreshUrl, returnUrl } = onboardingUrls();
  const link = await getStripe().accountLinks.create({
    account: stripeAccountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
    // Pede de uma vez tudo que estiver pendente, e não só o mínimo para
    // ativar: evita o vaivém de o admin voltar três vezes ao mesmo fluxo.
    collection_options: { fields: "eventually_due" },
  });
  return link.url;
}

/**
 * Acesso ao dashboard Express da conta conectada — onde a escola vê seus
 * repasses e ajusta a conta bancária. Também é um link de uso único.
 */
export async function createDashboardLink(stripeAccountId: string): Promise<string> {
  const login = await getStripe().accounts.createLoginLink(stripeAccountId);
  return login.url;
}

/**
 * Relê a conta na Stripe e regrava o espelho local. Chamado pelo botão
 * "Atualizar status" e no retorno do onboarding: o webhook `account.updated`
 * é a fonte confiável, mas pode levar segundos, e o admin acabou de voltar
 * para a tela esperando ver o resultado.
 */
export async function refreshConnectAccount(
  organizationId: string,
  stripeAccountId: string,
): Promise<ConnectAccount | null> {
  const account = await getStripe().accounts.retrieve(stripeAccountId);
  return upsertConnectAccount(accountSnapshot(account, organizationId));
}

/** Espelha um `account.updated` vindo do webhook, sem round-trip extra. */
export async function syncConnectAccountFromEvent(
  account: Stripe.Account,
): Promise<void> {
  const organizationId = account.metadata?.["organization_id"];
  if (!organizationId) return;
  await upsertConnectAccount(accountSnapshot(account, organizationId));
}

/**
 * A conta está pronta para receber dinheiro de aluno? Só `charges_enabled`
 * responde isso: uma conta com onboarding submetido mas em análise ainda
 * recusa cobrança, e publicar planos nesse estado gera erro no checkout do
 * aluno — o pior lugar possível para descobrir o problema.
 */
export function canCollectPayments(account: ConnectAccount | null): boolean {
  return Boolean(account?.chargesEnabled);
}
