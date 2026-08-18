"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { requestPasswordResetSchema } from "@/schemas/auth";
import { fail, ok, type ActionResult } from "@/types/action-result";
import { env } from "@/lib/env";

export async function requestPasswordResetAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const parsed = requestPasswordResetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }
  const { email } = parsed.data;

  const ip = await getClientIp();
  const allowed = await checkRateLimit(
    `${ip}:${email.toLowerCase()}`,
    "password_reset",
    3,
    900,
  );
  if (!allowed) {
    return fail(
      "RATE_LIMITED",
      "Muitas solicitações. Aguarde alguns minutos e tente novamente.",
    );
  }

  const supabase = await createServerSupabaseClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/api/auth/confirm?next=/redefinir-senha`,
  });

  // Sempre "sucesso" aqui, exista ou não o e-mail — anti-enumeração (§9 A07).
  return ok(undefined as never);
}
