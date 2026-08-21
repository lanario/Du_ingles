"use server";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getDefaultOrganizationId } from "@/lib/organization";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { trialClassSchema } from "@/schemas/leads";
import { fail, ok, type ActionResult } from "@/types/action-result";

/**
 * Pedido de aula experimental.
 *
 * Reaproveita a tabela `leads` — é a mesma coisa do ponto de vista da
 * coordenação — e escreve maioridade e objetivo dentro de `message`, num
 * cabeçalho legível, em vez de abrir colunas novas para dois campos que só
 * este formulário usa. O limite de envios é compartilhado com o formulário de
 * contato (mesma chave), senão o visitante teria 10 tentativas por hora só por
 * existirem dois formulários na mesma página.
 */
export async function createTrialLeadAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const parsed = trialClassSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    isAdult: formData.get("isAdult"),
    goal: formData.get("goal") || undefined,
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos destacados.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const ip = await getClientIp();
  const allowed = await checkRateLimit(ip, "create_lead", 5, 3600);
  if (!allowed) {
    return fail("RATE_LIMITED", "Muitas solicitações. Tente novamente mais tarde.");
  }

  const { name, email, phone, isAdult, goal } = parsed.data;
  const message = [
    "Pedido de aula experimental",
    `Maior de 18 anos: ${isAdult === "sim" ? "sim" : "não (falar com o responsável)"}`,
    goal ? `Objetivo das aulas: ${goal}` : "Objetivo das aulas: não informado",
  ].join("\n");

  const organizationId = await getDefaultOrganizationId();
  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("leads").insert({
    organization_id: organizationId,
    name,
    email,
    phone,
    message,
  });

  if (error) {
    return fail(
      "INTERNAL_ERROR",
      "Não foi possível enviar. Tente novamente em instantes.",
    );
  }

  return ok(undefined as never);
}
