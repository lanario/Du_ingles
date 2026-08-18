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
