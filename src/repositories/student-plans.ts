import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { StudentPlanInput, PlanAccent, PlanInterval } from "@/schemas/student-plans";
import type { Database } from "@/types/database.types";
import type { CefrLevel } from "@/types/domain";

export type PlanSyncStatus = Database["public"]["Enums"]["plan_sync_status"];

export interface StudentPlan {
  id: string;
  organizationId: string;
  name: string;
  headline: string | null;
  description: string | null;
  features: string[];

  priceCents: number;
  currency: string;
  billingInterval: PlanInterval;
  setupFeeCents: number;
  trialDays: number;

  lessonsPerMonth: number | null;
  minutesPerLesson: number | null;
  level: CefrLevel | null;
  seatLimit: number | null;

  accent: PlanAccent;
  badge: string | null;
  isFeatured: boolean;
  isPublic: boolean;
  isActive: boolean;
  sortOrder: number;

  stripeProductId: string | null;
  stripePriceId: string | null;
  stripePaymentLinkId: string | null;
  stripePaymentLinkUrl: string | null;
  syncStatus: PlanSyncStatus;
  syncError: string | null;
  syncedAt: string | null;

  createdAt: string;
  /** Assinantes ativos ou em teste — o que ocupa vaga do `seatLimit`. */
  activeSubscribers: number;
}

type Row = Database["public"]["Tables"]["student_plans"]["Row"];

function toFeatures(raw: Row["features"]): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string");
}

function mapRow(row: Row, activeSubscribers = 0): StudentPlan {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    headline: row.headline,
    description: row.description,
    features: toFeatures(row.features),
    priceCents: Number(row.price_cents),
    currency: row.currency,
    billingInterval: row.billing_interval,
    setupFeeCents: Number(row.setup_fee_cents),
    trialDays: row.trial_days,
    lessonsPerMonth: row.lessons_per_month,
    minutesPerLesson: row.minutes_per_lesson,
    level: row.level,
    seatLimit: row.seat_limit,
    accent: row.accent as PlanAccent,
    badge: row.badge,
    isFeatured: row.is_featured,
    isPublic: row.is_public,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    stripeProductId: row.stripe_product_id,
    stripePriceId: row.stripe_price_id,
    stripePaymentLinkId: row.stripe_payment_link_id,
    stripePaymentLinkUrl: row.stripe_payment_link_url,
    syncStatus: row.sync_status,
    syncError: row.sync_error,
    syncedAt: row.synced_at,
    createdAt: row.created_at,
    activeSubscribers,
  };
}

/** Assinaturas que ocupam vaga: pagando ou em período de teste. */
const OCCUPYING_STATUSES = ["active", "trialing", "past_due"] as const;

/**
 * Catálogo completo da organização, com a contagem de assinantes por plano
 * resolvida em *uma* query agregada — nunca uma por plano (§10.1, zero N+1).
 */
export async function listStudentPlans(organizationId: string): Promise<StudentPlan[]> {
  const admin = createAdminSupabaseClient();

  const [{ data: plans }, { data: subs }] = await Promise.all([
    admin
      .from("student_plans")
      .select("*")
      .eq("organization_id", organizationId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
    admin
      .from("student_subscriptions")
      .select("plan_id")
      .eq("organization_id", organizationId)
      .in("status", OCCUPYING_STATUSES),
  ]);

  if (!plans) return [];

  const counts = new Map<string, number>();
  for (const sub of subs ?? []) {
    if (!sub.plan_id) continue;
    counts.set(sub.plan_id, (counts.get(sub.plan_id) ?? 0) + 1);
  }

  return plans.map((row) => mapRow(row, counts.get(row.id) ?? 0));
}

/**
 * O que o aluno enxerga: publicado, à venda e já espelhado na Stripe. Um
 * plano em `draft` ou `error` não pode aparecer na vitrine — o botão
 * "assinar" não teria preço para onde apontar.
 */
export async function listPublicPlans(organizationId: string): Promise<StudentPlan[]> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("student_plans")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_public", true)
    .eq("is_active", true)
    .eq("sync_status", "synced")
    .order("sort_order", { ascending: true })
    .order("price_cents", { ascending: true });

  return (data ?? []).map((row) => mapRow(row));
}

export async function getStudentPlan(
  planId: string,
  organizationId: string,
): Promise<StudentPlan | null> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("student_plans")
    .select("*")
    .eq("id", planId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  return data ? mapRow(data) : null;
}

/** Usado pelo webhook, que só conhece o `price` da Stripe. */
export async function getPlanByStripePriceId(
  stripePriceId: string,
): Promise<StudentPlan | null> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("student_plans")
    .select("*")
    .eq("stripe_price_id", stripePriceId)
    .maybeSingle();

  return data ? mapRow(data) : null;
}

function toRow(input: StudentPlanInput) {
  return {
    name: input.name,
    headline: input.headline ?? null,
    description: input.description ?? null,
    features: input.features,
    price_cents: input.priceCents,
    billing_interval: input.billingInterval,
    setup_fee_cents: input.setupFeeCents,
    trial_days: input.trialDays ?? 0,
    lessons_per_month: input.lessonsPerMonth ?? null,
    minutes_per_lesson: input.minutesPerLesson ?? null,
    level: (input.level ?? null) as CefrLevel | null,
    seat_limit: input.seatLimit ?? null,
    accent: input.accent,
    badge: input.badge ?? null,
    is_featured: input.isFeatured,
    is_public: input.isPublic,
    sort_order: input.sortOrder,
  };
}

export async function createStudentPlan(
  input: StudentPlanInput,
  organizationId: string,
  createdBy: string,
): Promise<{ success: true; plan: StudentPlan } | { success: false; message: string }> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("student_plans")
    .insert({
      ...toRow(input),
      organization_id: organizationId,
      created_by: createdBy,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { success: false, message: error?.message ?? "Falha ao criar o plano." };
  }
  return { success: true, plan: mapRow(data) };
}

export async function updateStudentPlan(
  planId: string,
  input: StudentPlanInput,
  organizationId: string,
): Promise<{ success: true; plan: StudentPlan } | { success: false; message: string }> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("student_plans")
    .update(toRow(input))
    .eq("id", planId)
    .eq("organization_id", organizationId)
    .select("*")
    .single();

  if (error || !data) {
    return { success: false, message: error?.message ?? "Falha ao salvar o plano." };
  }
  return { success: true, plan: mapRow(data) };
}

/**
 * Grava o resultado do espelhamento na Stripe. Os ids vêm separados do resto
 * da edição de propósito: o admin salva o plano num caminho e a Stripe
 * responde noutro, e misturar os dois faria uma falha de rede reverter texto
 * que o admin já tinha escrito.
 */
export async function saveStripeMirror(
  planId: string,
  mirror: {
    productId: string;
    priceId: string;
    paymentLinkId: string | null;
    paymentLinkUrl: string | null;
  },
): Promise<void> {
  const admin = createAdminSupabaseClient();
  await admin
    .from("student_plans")
    .update({
      stripe_product_id: mirror.productId,
      stripe_price_id: mirror.priceId,
      stripe_payment_link_id: mirror.paymentLinkId,
      stripe_payment_link_url: mirror.paymentLinkUrl,
      sync_status: "synced",
      sync_error: null,
      synced_at: new Date().toISOString(),
    })
    .eq("id", planId);
}

export async function markSyncError(planId: string, message: string): Promise<void> {
  const admin = createAdminSupabaseClient();
  await admin
    .from("student_plans")
    .update({ sync_status: "error", sync_error: message.slice(0, 500) })
    .eq("id", planId);
}

/**
 * Arquivar, não apagar. O plano some da venda e da vitrine, mas continua
 * ligado às assinaturas que ele originou — sem isso o histórico financeiro
 * ficaria com contratos apontando para o nada.
 */
export async function setStudentPlanActive(
  planId: string,
  isActive: boolean,
  organizationId: string,
): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("student_plans")
    .update({ is_active: isActive })
    .eq("id", planId)
    .eq("organization_id", organizationId);
  return !error;
}

/** Reordenação por arrastar na lista do admin — uma escrita por plano movido. */
export async function reorderStudentPlans(
  order: { id: string; sortOrder: number }[],
  organizationId: string,
): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const results = await Promise.all(
    order.map((item) =>
      admin
        .from("student_plans")
        .update({ sort_order: item.sortOrder })
        .eq("id", item.id)
        .eq("organization_id", organizationId),
    ),
  );
  return results.every((r) => !r.error);
}
