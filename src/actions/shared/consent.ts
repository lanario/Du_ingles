"use server";

import { z } from "zod";
import { getSessionContext } from "@/lib/auth/session";
import { CONSENT_VERSION } from "@/lib/consent/config";
import { recordConsent } from "@/lib/consent/record";
import { getDefaultOrganizationId } from "@/lib/organization";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const cookieConsentSchema = z.object({
  consentId: z.string().min(8).max(64),
  version: z.literal(CONSENT_VERSION),
  choices: z.object({
    preferences: z.boolean(),
    analytics: z.boolean(),
    marketing: z.boolean(),
  }),
});

/**
 * Registro da escolha feita no banner/janela de cookies. É público (visitante
 * sem conta também decide), por isso o rate limit por IP; quem está logado
 * fica associado à própria conta.
 */
export async function recordCookieConsentAction(input: unknown): Promise<void> {
  const parsed = cookieConsentSchema.safeParse(input);
  if (!parsed.success) return;

  const allowed = await checkRateLimit(await getClientIp(), "cookie_consent", 30, 3600);
  if (!allowed) return;

  const session = await getSessionContext();
  const { preferences, analytics, marketing } = parsed.data.choices;

  await recordConsent({
    organizationId: session?.organizationId || (await getDefaultOrganizationId()),
    purpose: "cookies",
    granted: preferences || analytics || marketing,
    documentVersion: parsed.data.version,
    subjectId: session?.userId ?? null,
    subjectEmail: session?.email ?? null,
    consentId: parsed.data.consentId,
    choices: { necessary: true, preferences, analytics, marketing },
  });
}
