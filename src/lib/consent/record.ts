import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getRequestMeta } from "@/lib/request-meta";
import type { Json } from "@/types/database.types";

/**
 * Versões dos textos que a pessoa aceita. Mudou a política ou os termos de
 * forma relevante? Suba a versão — os registros antigos continuam apontando
 * para o texto que foi de fato aceito naquela data.
 */
export const PRIVACY_POLICY_VERSION = "2026-09-22";
export const TERMS_VERSION = "2026-09-22";

export type ConsentPurpose =
  "cookies" | "contact_form" | "trial_class" | "terms_and_privacy" | "google_calendar";

interface RecordConsentInput {
  organizationId: string;
  purpose: ConsentPurpose;
  granted: boolean;
  documentVersion: string;
  subjectId?: string | null;
  subjectEmail?: string | null;
  /** Identificador anônimo do navegador (cookie `du_consent`). */
  consentId?: string | null;
  choices?: Record<string, Json>;
}

/**
 * Prova de consentimento (LGPD art. 8 §1 e §2 — o ônus é do controlador).
 *
 * `consent_records` é append-only e só o service-role escreve, no mesmo
 * desenho de `audit_logs`: revogar é inserir uma linha nova com
 * `granted = false`, nunca editar a antiga.
 *
 * Não lança. Quem chama já concluiu a ação principal (o lead foi gravado, o
 * cadastro foi criado); perder o registro é ruim, mas derrubar o formulário
 * por causa dele seria pior. A falha fica no log do servidor.
 */
export async function recordConsent(input: RecordConsentInput): Promise<void> {
  try {
    const meta = await getRequestMeta();
    const admin = createAdminSupabaseClient();
    const { error } = await admin.from("consent_records").insert({
      organization_id: input.organizationId,
      purpose: input.purpose,
      granted: input.granted,
      document_version: input.documentVersion,
      subject_id: input.subjectId ?? null,
      subject_email: input.subjectEmail ?? null,
      consent_id: input.consentId ?? null,
      choices: input.choices ?? {},
      ip_address: meta.ip,
      user_agent: meta.userAgent,
    });
    if (error) {
      console.error(`[consent] falha ao registrar "${input.purpose}":`, error.message);
    }
  } catch (error) {
    console.error(`[consent] falha ao registrar "${input.purpose}":`, error);
  }
}
