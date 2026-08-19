/**
 * Vocabulário visual do Financeiro: formatação de dinheiro e de data, o
 * estado derivado de cada lançamento e os tons que a tela usa para cada um.
 *
 * Sem `"use client"` de propósito — a página (Server Component) usa as mesmas
 * funções para montar rótulos antes de entregar o dado ao cliente.
 */

import {
  categoryOf,
  type FinanceDirection,
  type PaymentMethod,
  PAYMENT_METHOD_LABEL,
} from "@/schemas/finance";
import type { FinanceEntry } from "@/repositories/finance";

export type { FinanceEntry };

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

/** `625000` → `R$ 6.250,00`. */
export function formatMoney(cents: number): string {
  return BRL.format(cents / 100);
}

/** Valor partido, para o card grande desenhar os centavos menores. */
export function splitMoney(cents: number): { whole: string; fraction: string } {
  const absolute = Math.abs(cents);
  const sign = cents < 0 ? "-" : "";
  return {
    whole: `${sign}${new Intl.NumberFormat("pt-BR").format(Math.floor(absolute / 100))}`,
    fraction: String(absolute % 100).padStart(2, "0"),
  };
}

/** `2026-08-11` → `11/08/2026`. Sem `Date`: a string já é a data local. */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

/** `2026-08-11` → `11/08`, para linhas apertadas. */
export function formatShortDate(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

/**
 * Estado exibido. `overdue` não existe no banco: é `pending` com vencimento
 * no passado, calculado contra a data que o servidor enviou — usar
 * `new Date()` aqui faria o HTML do servidor divergir do cliente.
 */
export type EntryState = "paid" | "overdue" | "pending";

export function entryState(entry: FinanceEntry, today: string): EntryState {
  if (entry.status === "paid") return "paid";
  return entry.dueOn < today ? "overdue" : "pending";
}

export const STATE_LABEL: Record<EntryState, string> = {
  paid: "Pago",
  overdue: "Vencido",
  pending: "Pendente",
};

/** Rótulo da baixa muda com a direção: dinheiro que entra é "recebido". */
export function stateLabel(state: EntryState, direction: FinanceDirection): string {
  if (state !== "paid") return STATE_LABEL[state];
  return direction === "in" ? "Recebido" : "Pago";
}

export const STATE_TONE: Record<EntryState, string> = {
  paid: "var(--success)",
  overdue: "var(--destructive)",
  pending: "var(--warning)",
};

/**
 * Verde entra, vermelho sai. É a convenção que qualquer pessoa que já olhou
 * um extrato lê sem legenda — e por isso vence a paleta institucional aqui.
 * Os dois tons são os da casa (`--success` e `--destructive`), não verde e
 * vermelho puros.
 */
export const DIRECTION_TONE: Record<FinanceDirection, string> = {
  in: "var(--success)",
  out: "var(--destructive)",
};

/** Degradê do botão de cadastro, no tom da aba ativa. */
export const DIRECTION_GRADIENT: Record<FinanceDirection, string> = {
  in: "linear-gradient(to right, #0a5c43, var(--success))",
  out: "linear-gradient(to right, #8f1d14, var(--destructive))",
};

export const DIRECTION_LABEL: Record<FinanceDirection, string> = {
  in: "Receita",
  out: "Despesa",
};

/** Rótulos que mudam com a aba, para não repetir ternário em cinco lugares. */
export const DIRECTION_COPY: Record<
  FinanceDirection,
  {
    tab: string;
    plural: string;
    total: string;
    settled: string;
    open: string;
    settle: string;
    create: string;
  }
> = {
  in: {
    tab: "Receitas",
    plural: "receitas",
    total: "Total previsto",
    settled: "Recebido",
    open: "A receber",
    settle: "Receber",
    create: "Registrar receita",
  },
  out: {
    tab: "Despesas",
    plural: "despesas",
    total: "Total previsto",
    settled: "Pago",
    open: "A pagar",
    settle: "Pagar",
    create: "Registrar despesa",
  },
};

export function categoryLabel(entry: FinanceEntry): string {
  return categoryOf(entry.category, entry.kind).label;
}

export function paymentLabel(method: PaymentMethod | null): string {
  return method ? PAYMENT_METHOD_LABEL[method] : "Não informado";
}

/** Filtros da barra de ferramentas. */
export type StateFilter = "all" | "open" | "overdue" | "paid";

export const STATE_FILTER_LABEL: Record<StateFilter, string> = {
  all: "Todos os status",
  open: "Em aberto",
  overdue: "Vencidos",
  paid: "Liquidados",
};

export function matchesStateFilter(
  entry: FinanceEntry,
  filter: StateFilter,
  today: string,
): boolean {
  if (filter === "all") return true;
  const state = entryState(entry, today);
  if (filter === "open") return state !== "paid";
  return state === filter;
}

export function entryMatches(entry: FinanceEntry, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;

  const haystack = [
    entry.description,
    entry.counterparty ?? "",
    categoryLabel(entry),
    formatDate(entry.dueOn),
    paymentLabel(entry.paymentMethod),
  ]
    .join(" ")
    .toLowerCase();

  return needle.split(/\s+/).every((part) => haystack.includes(part));
}

export type SortMode = "due" | "amount" | "description";

export const SORT_LABEL: Record<SortMode, string> = {
  due: "Por vencimento",
  amount: "Maior valor",
  description: "Por descrição",
};

export function sortEntries(entries: FinanceEntry[], mode: SortMode): FinanceEntry[] {
  const copy = [...entries];
  if (mode === "amount") return copy.sort((a, b) => b.amountCents - a.amountCents);
  if (mode === "description")
    return copy.sort((a, b) => a.description.localeCompare(b.description, "pt-BR"));
  return copy.sort((a, b) => a.dueOn.localeCompare(b.dueOn));
}

export interface CategorySlice {
  id: string;
  label: string;
  cents: number;
  /** Fatia sobre o total da direção, de 0 a 1. */
  share: number;
  /** Quantos lançamentos formam a fatia — aparece no hover da barra. */
  count: number;
}

/**
 * Quanto cada linha de negócio pesou. Ordenado pelo valor porque a pergunta
 * é sempre "de onde veio (ou para onde foi) a maior parte".
 */
export function sliceByCategory(entries: FinanceEntry[]): CategorySlice[] {
  const totals = new Map<string, { label: string; cents: number; count: number }>();
  let sum = 0;

  for (const entry of entries) {
    const label = categoryLabel(entry);
    const current = totals.get(entry.category) ?? { label, cents: 0, count: 0 };
    current.cents += entry.amountCents;
    current.count += 1;
    totals.set(entry.category, current);
    sum += entry.amountCents;
  }

  return Array.from(totals, ([id, value]) => ({
    id,
    label: value.label,
    cents: value.cents,
    count: value.count,
    share: sum > 0 ? value.cents / sum : 0,
  })).sort((a, b) => b.cents - a.cents);
}

/** `2026-08` → `Agosto de 2026`, no cliente (o servidor usa `monthTitle`). */
const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function monthKeyTitle(key: string): string {
  const [year, month] = key.split("-");
  return `${MONTH_NAMES[Number(month) - 1] ?? key} de ${year}`;
}

/** Primeiro dia da competência — sugestão de data ao abrir o formulário. */
export function firstDayOf(monthKey: string): string {
  return `${monthKey}-01`;
}

/**
 * Data sugerida ao lançar dentro do mês exibido: hoje quando a competência é
 * a corrente, dia 1 quando o admin está navegando por outro mês.
 */
export function suggestedDate(monthKey: string, today: string): string {
  return today.startsWith(monthKey) ? today : firstDayOf(monthKey);
}
