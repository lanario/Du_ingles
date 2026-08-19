import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database.types";

export type ChargeModel = Database["public"]["Enums"]["stripe_charge_model"];

export interface ConnectAccount {
  id: string;
  organizationId: string;
  stripeAccountId: string;
  chargeModel: ChargeModel;
  applicationFeePercent: number;
  country: string;
  defaultCurrency: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  /** Códigos crus de pendência do onboarding, como a Stripe os devolve. */
  requirementsDue: string[];
  businessName: string | null;
  livemode: boolean;
  connectedAt: string | null;
}

type Row = Database["public"]["Tables"]["stripe_connect_accounts"]["Row"];

/**
 * `requirements` chega como o objeto inteiro da Stripe. Para a UI só
 * interessam as pendências que travam a cobrança — `currently_due` somado a
 * `past_due`, sem repetição.
 */
function requirementsDue(raw: Row["requirements"]): string[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const record = raw as Record<string, unknown>;
  const listOf = (key: string): unknown[] =>
    Array.isArray(record[key]) ? (record[key] as unknown[]) : [];
  const merged = [...listOf("currently_due"), ...listOf("past_due")];
  return [...new Set(merged.filter((item): item is string => typeof item === "string"))];
}

function mapRow(row: Row): ConnectAccount {
  return {
    id: row.id,
    organizationId: row.organization_id,
    stripeAccountId: row.stripe_account_id,
    chargeModel: row.charge_model,
    applicationFeePercent: Number(row.application_fee_percent),
    country: row.country,
    defaultCurrency: row.default_currency,
    chargesEnabled: row.charges_enabled,
    payoutsEnabled: row.payouts_enabled,
    detailsSubmitted: row.details_submitted,
    requirementsDue: requirementsDue(row.requirements),
    businessName: row.business_name,
    livemode: row.livemode,
    connectedAt: row.connected_at,
  };
}

/**
 * Todas as leituras/escritas daqui usam service-role: a conta conectada é
 * consultada por caminhos que não têm sessão de usuário (o webhook da Stripe,
 * o checkout do aluno), e nesses o RLS por `auth_org()` não teria o que
 * avaliar. Quem chama a partir de uma tela já passou por `requireRole`, e a
 * query é sempre escopada por `organization_id` explícito — mesmo contrato de
 * `repositories/finance.ts`.
 */
export async function getConnectAccount(
  organizationId: string,
): Promise<ConnectAccount | null> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("stripe_connect_accounts")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();

  return data ? mapRow(data) : null;
}

/** Usado pelo webhook, que só conhece o id da conta na Stripe. */
export async function getConnectAccountByStripeId(
  stripeAccountId: string,
): Promise<ConnectAccount | null> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("stripe_connect_accounts")
    .select("*")
    .eq("stripe_account_id", stripeAccountId)
    .maybeSingle();

  return data ? mapRow(data) : null;
}

export interface UpsertConnectAccountInput {
  organizationId: string;
  stripeAccountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirements: Record<string, unknown>;
  country: string;
  defaultCurrency: string;
  businessName: string | null;
  livemode: boolean;
}

/**
 * Grava o estado da conta conectada. `onConflict: organization_id` faz o
 * refresh pós-onboarding ser o mesmo caminho da criação — o webhook
 * `account.updated` e o botão "Atualizar status" chamam esta função sem
 * precisar saber se a linha já existe.
 *
 * `charge_model` e `application_fee_percent` ficam de fora: são decisões
 * comerciais do admin, não estado espelhado da Stripe, e um refresh não pode
 * sobrescrevê-las.
 */
export async function upsertConnectAccount(
  input: UpsertConnectAccountInput,
): Promise<ConnectAccount | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("stripe_connect_accounts")
    .upsert(
      {
        organization_id: input.organizationId,
        stripe_account_id: input.stripeAccountId,
        charges_enabled: input.chargesEnabled,
        payouts_enabled: input.payoutsEnabled,
        details_submitted: input.detailsSubmitted,
        requirements: input.requirements as Database["public"]["Tables"]["stripe_connect_accounts"]["Insert"]["requirements"],
        country: input.country,
        default_currency: input.defaultCurrency,
        business_name: input.businessName,
        livemode: input.livemode,
        // Só marca a data na primeira vez que a conta passa a poder cobrar.
        ...(input.chargesEnabled ? { connected_at: new Date().toISOString() } : {}),
      },
      { onConflict: "organization_id" },
    )
    .select("*")
    .single();

  if (error) {
    console.error("[stripe-connect] falha ao gravar conta:", error.message);
    return null;
  }
  return mapRow(data);
}

/** Ajustes comerciais da conta — separados do espelho da Stripe de propósito. */
export async function updateConnectSettings(
  organizationId: string,
  settings: { chargeModel?: ChargeModel; applicationFeePercent?: number },
): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("stripe_connect_accounts")
    .update({
      ...(settings.chargeModel ? { charge_model: settings.chargeModel } : {}),
      ...(settings.applicationFeePercent !== undefined
        ? { application_fee_percent: settings.applicationFeePercent }
        : {}),
    })
    .eq("organization_id", organizationId);

  if (error) {
    console.error("[stripe-connect] falha ao salvar ajustes:", error.message);
    return false;
  }
  return true;
}

export async function deleteConnectAccount(organizationId: string): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("stripe_connect_accounts")
    .delete()
    .eq("organization_id", organizationId);
  return !error;
}
