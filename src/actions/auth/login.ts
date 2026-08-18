"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";
import { loginSchema } from "@/schemas/auth";
import { fail, type ActionResult } from "@/types/action-result";
import type { AppRole } from "@/types/domain";

const GENERIC_ERROR = "E-mail ou senha inválidos.";

export async function loginAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }
  const { email, password } = parsed.data;

  const ip = await getClientIp();
  // 5 tentativas / 15 min, por IP+e-mail combinados — nem um IP isolado
  // nem um e-mail isolado bloqueia sozinho (§9 A07).
  const allowed = await checkRateLimit(`${ip}:${email.toLowerCase()}`, "login", 5, 900);
  if (!allowed) {
    return fail(
      "RATE_LIMITED",
      "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  // Mensagem genérica sempre — nunca revelar se o e-mail existe (evita
  // enumeração de usuários).
  if (error || !data.user) {
    return fail("UNAUTHENTICATED", GENERIC_ERROR);
  }

  const admin = createAdminSupabaseClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, organization_id, is_active, deleted_at")
    .eq("id", data.user.id)
    .single();

  if (!profile || !profile.is_active || profile.deleted_at) {
    await supabase.auth.signOut();
    return fail("UNAUTHENTICATED", GENERIC_ERROR);
  }

  await auditLog({
    organizationId: profile.organization_id,
    actorId: data.user.id,
    actorRole: profile.role as AppRole,
    action: "LOGIN",
  });

  redirect(profile.role === "admin" ? "/admin" : "/dashboard");
}
