"use server";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getDefaultOrganizationId } from "@/lib/organization";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { CREATE_LEAD_FIELDS, createLeadSchema } from "@/schemas/leads";
import { describeInvalidFields } from "@/lib/form-errors";
import { notifyLeadReceived } from "@/lib/notifications/events";
import { fail, ok, type ActionResult } from "@/types/action-result";

export async function createLeadAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const parsed = createLeadSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    message: formData.get("message") || undefined,
  });
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors as Record<string, string[]>;
    return fail(
      "VALIDATION_ERROR",
      describeInvalidFields(fields, CREATE_LEAD_FIELDS),
      fields,
    );
  }

  const ip = await getClientIp();
  const allowed = await checkRateLimit(ip, "create_lead", 5, 3600);
  if (!allowed) {
    return fail("RATE_LIMITED", "Muitas solicitações. Tente novamente mais tarde.");
  }

  const organizationId = await getDefaultOrganizationId();
  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("leads").insert({
    organization_id: organizationId,
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone ?? null,
    message: parsed.data.message ?? null,
  });

  if (error) {
    return fail(
      "INTERNAL_ERROR",
      "Não foi possível enviar. Tente novamente em instantes.",
    );
  }

  notifyLeadReceived({
    organizationId,
    name: parsed.data.name,
    kind: "contact",
    contact: parsed.data.phone ?? parsed.data.email,
  });

  return ok(undefined as never);
}
