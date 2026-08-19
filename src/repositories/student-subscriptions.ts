import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database.types";

export type SubscriptionStatus = Database["public"]["Enums"]["subscription_status"];

export interface StudentSubscription {
  id: string;
  organizationId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  planId: string | null;
  planName: string | null;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEnd: string | null;
  amountCents: number | null;
  currency: string;
  hostedInvoiceUrl: string | null;
  createdAt: string;
}

const SELECT =
  "*, plan:plan_id(name), student:student_id(full_name, email)";

type JoinedRow = Database["public"]["Tables"]["student_subscriptions"]["Row"] & {
  plan: { name: string } | null;
  student: { full_name: string; email: string } | null;
};

function mapRow(row: JoinedRow): StudentSubscription {
  return {
    id: row.id,
    organizationId: row.organization_id,
    studentId: row.student_id,
    studentName: row.student?.full_name ?? "—",
    studentEmail: row.student?.email ?? "",
    planId: row.plan_id,
    planName: row.plan?.name ?? null,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    status: row.status,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    trialEnd: row.trial_end,
    amountCents: row.amount_cents === null ? null : Number(row.amount_cents),
    currency: row.currency,
    hostedInvoiceUrl: row.hosted_invoice_url,
    createdAt: row.created_at,
  };
}

export async function listSubscriptions(
  organizationId: string,
): Promise<StudentSubscription[]> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("student_subscriptions")
    .select(SELECT)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  return ((data ?? []) as unknown as JoinedRow[]).map(mapRow);
}

/**
 * A assinatura vigente do aluno. Um aluno pode ter várias linhas ao longo do
 * tempo (trocou de plano, cancelou e voltou); a que importa para a vitrine é
 * a mais recente que ainda vale alguma coisa.
 */
export async function getActiveSubscriptionFor(
  studentId: string,
): Promise<StudentSubscription | null> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("student_subscriptions")
    .select(SELECT)
    .eq("student_id", studentId)
    .in("status", ["active", "trialing", "past_due", "unpaid", "paused"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? mapRow(data as unknown as JoinedRow) : null;
}

/**
 * Último `customer` da Stripe já associado a este aluno. Reaproveitá-lo é o
 * que impede a conta de encher de Customers duplicados — um por tentativa de
 * checkout — e o que faz o portal de faturas mostrar o histórico inteiro.
 */
export async function findStripeCustomerId(studentId: string): Promise<string | null> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("student_subscriptions")
    .select("stripe_customer_id")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.stripe_customer_id ?? null;
}

export interface UpsertSubscriptionInput {
  organizationId: string;
  studentId: string;
  planId: string | null;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripeCheckoutSessionId?: string | null;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  trialEnd: string | null;
  amountCents: number | null;
  currency: string;
  hostedInvoiceUrl: string | null;
}

/**
 * Ponto único de escrita das assinaturas — sempre a partir de um evento da
 * Stripe já verificado. `onConflict: stripe_subscription_id` torna o webhook
 * idempotente: a Stripe reentrega eventos, e reentrega fora de ordem.
 */
export async function upsertSubscription(
  input: UpsertSubscriptionInput,
): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("student_subscriptions").upsert(
    {
      organization_id: input.organizationId,
      student_id: input.studentId,
      plan_id: input.planId,
      stripe_customer_id: input.stripeCustomerId,
      stripe_subscription_id: input.stripeSubscriptionId,
      stripe_checkout_session_id: input.stripeCheckoutSessionId ?? null,
      status: input.status,
      current_period_start: input.currentPeriodStart,
      current_period_end: input.currentPeriodEnd,
      cancel_at_period_end: input.cancelAtPeriodEnd,
      canceled_at: input.canceledAt,
      trial_end: input.trialEnd,
      amount_cents: input.amountCents,
      currency: input.currency,
      hosted_invoice_url: input.hostedInvoiceUrl,
    },
    { onConflict: "stripe_subscription_id" },
  );

  if (error) {
    console.error("[subscriptions] falha ao gravar:", error.message);
    return false;
  }
  return true;
}

/** Só a URL da última fatura — usada por `invoice.*`, que não traz o resto. */
export async function attachLatestInvoice(
  stripeSubscriptionId: string,
  hostedInvoiceUrl: string | null,
): Promise<void> {
  if (!hostedInvoiceUrl) return;
  const admin = createAdminSupabaseClient();
  await admin
    .from("student_subscriptions")
    .update({ hosted_invoice_url: hostedInvoiceUrl })
    .eq("stripe_subscription_id", stripeSubscriptionId);
}

export interface SubscriptionSummary {
  activeCount: number;
  trialingCount: number;
  pastDueCount: number;
  /** Receita recorrente mensal normalizada, em centavos. */
  mrrCents: number;
}

/**
 * MRR sobre as assinaturas vigentes. Anual e semestral entram rateados no
 * mês — sem isso um plano anual de R$ 2.400 apareceria como R$ 2.400 de
 * receita mensal e distorceria o número inteiro.
 */
export async function getSubscriptionSummary(
  organizationId: string,
): Promise<SubscriptionSummary> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("student_subscriptions")
    .select("status, amount_cents, plan:plan_id(billing_interval)")
    .eq("organization_id", organizationId);

  const rows = (data ?? []) as unknown as {
    status: SubscriptionStatus;
    amount_cents: number | null;
    plan: { billing_interval: string } | null;
  }[];

  const MONTHS: Record<string, number> = {
    month: 1,
    quarter: 3,
    semester: 6,
    year: 12,
  };

  let activeCount = 0;
  let trialingCount = 0;
  let pastDueCount = 0;
  let mrrCents = 0;

  for (const row of rows) {
    if (row.status === "trialing") trialingCount += 1;
    if (row.status === "past_due" || row.status === "unpaid") pastDueCount += 1;
    if (row.status !== "active") continue;

    activeCount += 1;
    const interval = row.plan?.billing_interval ?? "month";
    // `one_time` não é receita recorrente: fica fora do MRR por definição.
    const months = MONTHS[interval];
    if (months) mrrCents += Math.round(Number(row.amount_cents ?? 0) / months);
  }

  return { activeCount, trialingCount, pastDueCount, mrrCents };
}
