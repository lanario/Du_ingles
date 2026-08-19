import { z } from "zod";

/**
 * Fonte única de verdade das variáveis de ambiente. Falha rápido no boot
 * (import time) em vez de quebrar em produção com uma variável ausente.
 */
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  // Ausente no runtime do browser — só validado quando o processo o expõe (servidor).
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  VIEW_AS_SECRET: z.string().min(32).optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  /*
   * Stripe — todas opcionais de propósito. A plataforma precisa subir inteira
   * sem cobrança configurada: só a área de planos entra em modo "não
   * configurado". Derrubar o boot por falta de chave levaria junto turmas,
   * mensagens e agenda, que nada têm a ver com pagamento.
   */
  STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

/** Uma env var declarada mas vazia ("") deve contar como ausente, não como valor inválido. */
function orUndefined(value: string | undefined): string | undefined {
  return value === "" ? undefined : value;
}

function loadEnv(): Env {
  const parsed = envSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env["NEXT_PUBLIC_SUPABASE_URL"],
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    SUPABASE_SERVICE_ROLE_KEY: orUndefined(process.env["SUPABASE_SERVICE_ROLE_KEY"]),
    VIEW_AS_SECRET: orUndefined(process.env["VIEW_AS_SECRET"]),
    NEXT_PUBLIC_SITE_URL: process.env["NEXT_PUBLIC_SITE_URL"],
    STRIPE_SECRET_KEY: orUndefined(process.env["STRIPE_SECRET_KEY"]),
    STRIPE_WEBHOOK_SECRET: orUndefined(process.env["STRIPE_WEBHOOK_SECRET"]),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: orUndefined(
      process.env["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"],
    ),
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Variáveis de ambiente inválidas ou ausentes:\n${issues}`);
  }

  return parsed.data;
}

export const env = loadEnv();

/** Chama isto apenas em código que roda exclusivamente no servidor. */
export function requireServiceRoleKey(): string {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  }
  return env.SUPABASE_SERVICE_ROLE_KEY;
}

export function requireViewAsSecret(): string {
  if (!env.VIEW_AS_SECRET) {
    throw new Error("VIEW_AS_SECRET não configurada.");
  }
  return env.VIEW_AS_SECRET;
}

/** `true` quando a integração de cobrança está utilizável neste ambiente. */
export function isStripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}

export function requireStripeSecretKey(): string {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY não configurada.");
  }
  return env.STRIPE_SECRET_KEY;
}

export function requireStripeWebhookSecret(): string {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET não configurada.");
  }
  return env.STRIPE_WEBHOOK_SECRET;
}
