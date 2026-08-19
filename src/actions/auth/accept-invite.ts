"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";
import * as invitesService from "@/services/invites";
import { acceptInviteSchema } from "@/schemas/invites";
import { fail, type ActionResult } from "@/types/action-result";

/**
 * Aceite do convite: é a única rota da aplicação que cria conta sem sessão,
 * então a defesa está toda aqui — token de uso único com validade
 * (`repositories/invites.ts`), rate limit por IP e validação integral do
 * cadastro. O papel vem do convite, nunca do formulário.
 *
 * Termina logando a pessoa: ela acabou de escolher a senha e o próximo
 * passo é usar o sistema — mandar para o login seria pedir a mesma senha
 * duas vezes seguidas.
 */
export async function acceptInviteAction(
  token: string,
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const parsed = acceptInviteSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    birthDate: formData.get("birthDate"),
    cpf: formData.get("cpf"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const ip = await getClientIp();
  // 10 tentativas por hora e por IP: sobra folga para quem erra o CPF ou a
  // confirmação de senha, e fecha a porta para varredura de tokens.
  const allowed = await checkRateLimit(ip, "accept_invite", 10, 3600);
  if (!allowed) {
    return fail(
      "RATE_LIMITED",
      "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
    );
  }

  const result = await invitesService.acceptInvite(token, parsed.data);

  if (!result.success) {
    if (result.reason === "email_taken") {
      return fail("CONFLICT", result.message, { email: [result.message] });
    }
    if (result.reason === "cpf_taken") {
      return fail("CONFLICT", result.message, { cpf: [result.message] });
    }
    if (result.reason === "invite_invalid") {
      return fail("NOT_FOUND", result.message);
    }
    return fail("INTERNAL_ERROR", result.message);
  }

  await auditLog({
    organizationId: result.organizationId,
    actorId: result.userId,
    actorRole: result.role,
    action: "USER_INVITE_ACCEPT",
    entityType: "profile",
    entityId: result.userId,
  });

  const supabase = await createServerSupabaseClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  // A conta existe de qualquer forma; se o login automático falhar, a
  // pessoa entra pelo /login com o que acabou de cadastrar.
  if (signInError) redirect("/login?cadastro=ok");

  redirect(result.role === "admin" ? "/admin" : "/dashboard");
}
