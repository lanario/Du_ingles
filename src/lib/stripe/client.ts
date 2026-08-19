import "server-only";
import Stripe from "stripe";
import { env, isStripeConfigured, requireStripeSecretKey } from "@/lib/env";

/**
 * Cliente da conta *plataforma* (Du Inglês). Toda chamada do Connect sai
 * daqui: criação da conta conectada, account links, e — no modelo
 * `destination` — os próprios produtos, preços e assinaturas, que nascem na
 * plataforma e só *transferem* o líquido para a escola.
 *
 * `import "server-only"` é o que garante que a secret key jamais entre num
 * bundle de cliente: qualquer import indireto a partir de um componente
 * `"use client"` quebra o build em vez de vazar a chave em produção.
 */

/**
 * Uma instância por processo. O SDK mantém keep-alive de conexão; instanciar
 * a cada request desperdiça handshake TLS em toda cobrança.
 */
let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (!cached) {
    cached = new Stripe(requireStripeSecretKey(), {
      // Sem `apiVersion` fixado o comportamento passa a depender da versão
      // configurada no dashboard — que alguém pode mudar sem tocar no código.
      apiVersion: "2026-07-29.dahlia",
      appInfo: { name: "Du Inglês", url: env.NEXT_PUBLIC_SITE_URL },
      // A rede falha; um POST de assinatura não pode morrer no primeiro
      // timeout. O SDK usa idempotency key própria nos retries.
      maxNetworkRetries: 2,
    });
  }
  return cached;
}

export { isStripeConfigured };

/**
 * `true` quando a chave em uso é de produção. A UI usa isto para marcar a
 * área de planos como ambiente de teste — sem esse aviso, é questão de tempo
 * até alguém mandar um link de sandbox para um aluno de verdade.
 */
export function isStripeLiveMode(): boolean {
  return env.STRIPE_SECRET_KEY?.startsWith("sk_live_") ?? false;
}

/**
 * Mensagem de erro da Stripe em português, pronta para a UI.
 *
 * Os erros da Stripe são precisos mas escritos para desenvolvedor
 * (`No such price: price_...`). O admin precisa de algo acionável; o texto
 * cru vai para o log, não para a tela.
 */
export function stripeErrorMessage(error: unknown): string {
  if (error instanceof Stripe.errors.StripeError) {
    console.error(`[stripe] ${error.type}: ${error.message}`);

    switch (error.type) {
      case "StripeAuthenticationError":
        return "A chave da Stripe é inválida ou foi revogada. Confira STRIPE_SECRET_KEY.";
      case "StripePermissionError":
        return "A conta conectada não autorizou esta operação. Refaça o onboarding.";
      case "StripeRateLimitError":
        return "A Stripe está limitando as requisições. Tente novamente em instantes.";
      case "StripeConnectionError":
        return "Não foi possível falar com a Stripe. Verifique a conexão e tente de novo.";
      case "StripeInvalidRequestError":
        return error.message;
      default:
        return "A Stripe recusou a operação. Tente novamente.";
    }
  }

  console.error("[stripe] erro inesperado:", error);
  return "Falha inesperada ao falar com a Stripe.";
}

export { Stripe };
