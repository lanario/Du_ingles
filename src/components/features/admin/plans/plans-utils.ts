/**
 * Vocabulário compartilhado da área de planos: formatação de dinheiro,
 * rótulos de periodicidade, tons por acento e os filtros da listagem.
 *
 * Fica em módulo próprio (sem `"use client"`) porque a vitrine do aluno e o
 * painel do admin consomem as mesmas funções — e a página do aluno é Server
 * Component.
 */

import type { StudentPlan } from "@/repositories/student-plans";
import type { PlanAccent, PlanInterval } from "@/schemas/student-plans";

export type { StudentPlan };

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

/** `24900` → `R$ 249,00`. */
export function formatMoney(cents: number, currency = "brl"): string {
  if (currency.toLowerCase() !== "brl") {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  }
  return BRL.format(cents / 100);
}

/**
 * Preço partido em inteiro e centavos, para o cartão desenhar os centavos
 * menores — a leitura do valor fica no número grande, não no `,00`.
 */
export function splitMoney(cents: number): { symbol: string; whole: string; fraction: string } {
  const whole = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, "0");
  return {
    symbol: "R$",
    whole: new Intl.NumberFormat("pt-BR").format(whole),
    fraction,
  };
}

/** Sufixo do preço: o que vem depois do valor no cartão. */
export const INTERVAL_SUFFIX: Record<PlanInterval, string> = {
  month: "/mês",
  quarter: "/trimestre",
  semester: "/semestre",
  year: "/ano",
  one_time: " à vista",
};

/** Rótulo por extenso, para selo e formulário. */
export const INTERVAL_LABEL: Record<PlanInterval, string> = {
  month: "Mensal",
  quarter: "Trimestral",
  semester: "Semestral",
  year: "Anual",
  one_time: "Pagamento único",
};

/** Quantos meses cada ciclo cobre. `null` para o que não é recorrente. */
const INTERVAL_MONTHS: Record<PlanInterval, number | null> = {
  month: 1,
  quarter: 3,
  semester: 6,
  year: 12,
  one_time: null,
};

/**
 * Valor equivalente por mês. É o número que faz um plano anual parecer o que
 * ele é — sem ele, R$ 2.388/ano parece caro ao lado de R$ 249/mês, quando na
 * verdade é mais barato.
 */
export function monthlyEquivalentCents(plan: StudentPlan): number | null {
  const months = INTERVAL_MONTHS[plan.billingInterval];
  if (!months || months === 1) return null;
  return Math.round(plan.priceCents / months);
}

/** Tons de acento. Espelham a paleta institucional; nada de cor solta. */
export const ACCENT_TONE: Record<PlanAccent, string> = {
  gold: "var(--gold-500)",
  navy: "var(--navy-600)",
  emerald: "var(--success)",
  violet: "#6d5bd0",
};

export const ACCENT_LABEL: Record<PlanAccent, string> = {
  gold: "Dourado",
  navy: "Marinho",
  emerald: "Esmeralda",
  violet: "Violeta",
};

// ---------------------------------------------------------------------------
// Estado de sincronização
// ---------------------------------------------------------------------------

export interface SyncBadge {
  label: string;
  tone: string;
  hint: string;
}

/**
 * O selo que responde à única pergunta que importa numa lista de planos:
 * *este plano já pode ser vendido?* Rascunho e erro não podem — e a diferença
 * entre eles muda o que o admin faz a seguir.
 */
export function syncBadge(plan: StudentPlan): SyncBadge {
  if (plan.syncStatus === "synced") {
    return {
      label: "Na Stripe",
      tone: "var(--success)",
      hint: "Preço publicado e pronto para cobrar.",
    };
  }
  if (plan.syncStatus === "error") {
    return {
      label: "Erro",
      tone: "var(--destructive)",
      hint: plan.syncError ?? "A Stripe recusou a última sincronização.",
    };
  }
  return {
    label: "Rascunho",
    tone: "var(--muted-foreground)",
    hint: "Ainda não existe na Stripe — não é possível cobrar por ele.",
  };
}

/** Vagas restantes. `null` quando o plano é ilimitado. */
export function seatsLeft(plan: StudentPlan): number | null {
  if (plan.seatLimit === null) return null;
  return Math.max(plan.seatLimit - plan.activeSubscribers, 0);
}

export function occupancyRatio(plan: StudentPlan): number {
  if (!plan.seatLimit) return 0;
  return Math.min(plan.activeSubscribers / plan.seatLimit, 1);
}

// ---------------------------------------------------------------------------
// Filtros e ordenação da listagem
// ---------------------------------------------------------------------------

export type StatusFilter = "all" | "active" | "draft" | "archived";

export const STATUS_LABEL: Record<StatusFilter, string> = {
  all: "Todos",
  active: "Publicados",
  draft: "Rascunhos",
  archived: "Arquivados",
};

export type SortMode = "order" | "price" | "subscribers" | "name";

export const SORT_LABEL: Record<SortMode, string> = {
  order: "Ordem da vitrine",
  price: "Maior preço",
  subscribers: "Mais assinantes",
  name: "Nome (A–Z)",
};

export function matchesStatus(plan: StudentPlan, status: StatusFilter): boolean {
  switch (status) {
    case "active":
      return plan.isActive && plan.syncStatus === "synced";
    case "draft":
      // Um plano ativo mas ainda não espelhado é, na prática, rascunho — é o
      // que o admin precisa terminar.
      return plan.isActive && plan.syncStatus !== "synced";
    case "archived":
      return !plan.isActive;
    case "all":
      return true;
  }
}

export function planMatches(plan: StudentPlan, search: string): boolean {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return [
    plan.name,
    plan.headline ?? "",
    plan.description ?? "",
    plan.badge ?? "",
    plan.level ?? "",
    INTERVAL_LABEL[plan.billingInterval],
    ...plan.features,
  ]
    .join(" ")
    .toLowerCase()
    .includes(term);
}

export function sortPlans(plans: StudentPlan[], mode: SortMode): StudentPlan[] {
  const copy = [...plans];
  switch (mode) {
    case "price":
      return copy.sort((a, b) => b.priceCents - a.priceCents);
    case "subscribers":
      return copy.sort((a, b) => b.activeSubscribers - a.activeSubscribers);
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    case "order":
      return copy.sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR"),
      );
  }
}

/** `2026-08-19T...` → `19/08/2026`. */
export function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(iso));
}

// Vocabulário e preços do construtor "nível → ritmo → compromisso" moram em
// `@/lib/plans/tier-catalog` (a camada de repositório também precisa deles,
// para o gerador do catálogo padrão). Reexportado aqui para não quebrar quem
// já importa tudo de planos a partir deste módulo.
export * from "@/lib/plans/tier-catalog";
