import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import { ptBR } from "date-fns/locale";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type {
  FinanceDirection,
  FinanceKind,
  FinanceStatus,
  PaymentMethod,
} from "@/schemas/finance";
import type { Database } from "@/types/database.types";

/**
 * Mesmo fuso do resto do painel. Aqui ele só existe para *rotular* os meses:
 * `occurred_on` é `date` puro no banco, então a competência de um lançamento
 * nunca escorrega de mês por causa de fuso — que é exatamente o motivo de a
 * coluna ser `date` e não `timestamptz`.
 */
const TZ = "America/Sao_Paulo";

/**
 * Teto da régua do gráfico de receita. Uma escola com anos de histórico
 * viraria uma linha ilegível de 60 pontos; 36 meses cobrem três exercícios.
 */
const MAX_MONTHS = 36;

export interface RevenuePoint {
  /** `YYYY-MM`. */
  key: string;
  /** Rótulo curto do eixo X: `jan de 26`. */
  label: string;
  revenueCents: number;
}

export interface IncomeStatement {
  /** `YYYY-MM` da competência fechada no card. */
  key: string;
  /** Nome do mês por extenso: `Agosto`. */
  monthLabel: string;
  grossRevenueCents: number;
  professionalCostCents: number;
  operatingExpenseCents: number;
  /** Receita bruta menos custos e despesas. Negativo quando o mês fecha no vermelho. */
  netResultCents: number;
  /** Resultado sobre receita bruta. `null` quando não houve receita no mês. */
  marginPercent: number | null;
}

export interface FinanceOverview {
  revenueSeries: RevenuePoint[];
  statement: IncomeStatement;
  /** Rótulo do início da série, para o título: `jan/26`. */
  seriesStartLabel: string;
  /** Ano do primeiro ponto da série, para a legenda do card. */
  seriesStartYear: number;
  /** `false` quando a organização ainda não lançou nada — habilita o estado vazio. */
  hasEntries: boolean;
  /** Soma da receita de toda a janela exibida. */
  windowRevenueCents: number;
}

/** Âncora no dia 15 ao meio-dia UTC: longe das bordas para o fuso não trocar o mês. */
function monthAnchor(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex, 15, 12));
}

function parseMonthKey(key: string): { year: number; monthIndex: number } {
  const [year, month] = key.split("-").map(Number);
  return { year: year!, monthIndex: month! - 1 };
}

/** Formata uma chave `YYYY-MM` com o padrão de data pedido, em pt-BR. */
export function monthLabel(key: string, pattern: string): string {
  const { year, monthIndex } = parseMonthKey(key);
  return formatInTimeZone(monthAnchor(year, monthIndex), TZ, pattern, { locale: ptBR });
}

/** pt-BR escreve mês em minúscula; no título do DRE ele é nome próprio da coluna. */
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Meses contínuos de `start` até `end`, inclusive, do mais antigo ao mais novo. */
function buildMonthRange(startKey: string, endKey: string): RevenuePoint[] {
  const start = parseMonthKey(startKey);
  const end = parseMonthKey(endKey);
  const total = (end.year - start.year) * 12 + (end.monthIndex - start.monthIndex) + 1;
  const clamped = Math.min(Math.max(total, 1), MAX_MONTHS);
  // Quando o histórico estoura o teto, é o começo que é cortado — o mês
  // corrente precisa continuar sendo o último ponto da linha.
  const offset = total - clamped;

  return Array.from({ length: clamped }, (_, index) => {
    const anchor = monthAnchor(start.year, start.monthIndex + offset + index);
    return {
      key: formatInTimeZone(anchor, TZ, "yyyy-MM"),
      label: formatInTimeZone(anchor, TZ, "LLL 'de' yy", { locale: ptBR }),
      revenueCents: 0,
    };
  });
}

/**
 * Receita mês a mês e DRE simplificado do mês corrente.
 *
 * Usa o client service-role pelo mesmo contrato de `repositories/dashboard.ts`:
 * a página consumidora já passou por `requireRole(["admin"])` e a query é
 * explicitamente escopada por `organization_id`.
 */
export async function getFinanceOverview(
  organizationId: string,
): Promise<FinanceOverview> {
  const admin = createAdminSupabaseClient();

  const now = new Date();
  const currentKey = formatInTimeZone(now, TZ, "yyyy-MM");
  const currentYear = Number(formatInTimeZone(now, TZ, "yyyy"));

  // A série começa em janeiro do exercício corrente, mas nunca depois do
  // primeiro lançamento registrado — assim a virada de ano não apaga o
  // histórico já visível, ela só estende a linha para trás.
  const { data: firstEntry } = await admin
    .from("finance_entries")
    .select("occurred_on")
    .eq("organization_id", organizationId)
    .order("occurred_on", { ascending: true })
    .limit(1)
    .maybeSingle();

  const januaryKey = `${currentYear}-01`;
  const firstEntryKey = firstEntry?.occurred_on.slice(0, 7);
  const startKey =
    firstEntryKey && firstEntryKey < januaryKey ? firstEntryKey : januaryKey;

  const series = buildMonthRange(startKey, currentKey);
  const windowStart = `${series[0]!.key}-01`;

  const { data: entries } = await admin
    .from("finance_entries")
    .select("kind, amount_cents, occurred_on")
    .eq("organization_id", organizationId)
    .gte("occurred_on", windowStart);

  const rows = entries ?? [];
  const revenueByMonth = new Map<string, number>();
  let grossRevenueCents = 0;
  let professionalCostCents = 0;
  let operatingExpenseCents = 0;

  for (const row of rows) {
    const key = row.occurred_on.slice(0, 7);
    const amount = Number(row.amount_cents);

    if (row.kind === "revenue") {
      revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + amount);
    }
    if (key !== currentKey) continue;

    if (row.kind === "revenue") grossRevenueCents += amount;
    else if (row.kind === "professional_cost") professionalCostCents += amount;
    else operatingExpenseCents += amount;
  }

  const revenueSeries = series.map((point) => ({
    ...point,
    revenueCents: revenueByMonth.get(point.key) ?? 0,
  }));

  const netResultCents =
    grossRevenueCents - professionalCostCents - operatingExpenseCents;

  const statement: IncomeStatement = {
    key: currentKey,
    monthLabel: capitalize(monthLabel(currentKey, "LLLL")),
    grossRevenueCents,
    professionalCostCents,
    operatingExpenseCents,
    netResultCents,
    marginPercent:
      grossRevenueCents > 0
        ? Math.round((1000 * netResultCents) / grossRevenueCents) / 10
        : null,
  };

  return {
    revenueSeries,
    statement,
    seriesStartLabel: monthLabel(series[0]!.key, "MMM/yy"),
    seriesStartYear: parseMonthKey(series[0]!.key).year,
    hasEntries: rows.length > 0 || Boolean(firstEntry),
    windowRevenueCents: revenueSeries.reduce((sum, p) => sum + p.revenueCents, 0),
  };
}

// ---------------------------------------------------------------------------
// Livro-caixa: os lançamentos de um mês, um a um
//
// `getFinanceOverview` acima existe para o dashboard — série anual e DRE
// agregados. Daqui para baixo é a tela de Financeiro: a *linha* de cada
// lançamento, com vencimento, baixa e forma de pagamento, sempre recortada
// por uma competência.
// ---------------------------------------------------------------------------

/** Data de hoje no fuso da escola (`yyyy-MM-dd`). */
export function todayInSchoolTz(): string {
  return formatInTimeZone(new Date(), TZ, "yyyy-MM-dd");
}

/** Competência corrente (`yyyy-MM`). */
export function currentMonthKey(): string {
  return formatInTimeZone(new Date(), TZ, "yyyy-MM");
}

/** `2026-08` vira `Agosto de 2026`. */
export function monthTitle(key: string): string {
  return capitalize(monthLabel(key, "LLLL 'de' yyyy"));
}

export interface FinanceEntry {
  id: string;
  kind: FinanceKind;
  /** `in` entra dinheiro, `out` sai. Derivado de `kind`, nunca gravado. */
  direction: FinanceDirection;
  category: string;
  description: string;
  counterparty: string | null;
  amountCents: number;
  /** Competência (`yyyy-MM-dd`). */
  occurredOn: string;
  dueOn: string;
  status: FinanceStatus;
  paidOn: string | null;
  paymentMethod: PaymentMethod | null;
  notes: string | null;
  createdAt: string;
}

export interface FinanceTotals {
  /** Tudo que o mês previu, pago ou não. */
  revenueCents: number;
  expenseCents: number;
  /** Previsto menos previsto: o resultado do mês se tudo for honrado. */
  netCents: number;
  /** Já liquidado. */
  revenuePaidCents: number;
  expensePaidCents: number;
  /** Em aberto (inclui o que já venceu). */
  revenueOpenCents: number;
  expenseOpenCents: number;
  /** Em aberto **e** com vencimento no passado. */
  revenueOverdueCents: number;
  expenseOverdueCents: number;
  revenueCount: number;
  expenseCount: number;
}

export interface FinanceMonth {
  /** `yyyy-MM`. */
  key: string;
  /** `Agosto de 2026`. */
  title: string;
  /** Competência anterior e seguinte, para as setas do seletor. */
  previousKey: string;
  nextKey: string;
  /** `yyyy-MM-dd` de hoje: a régua que decide o que está vencido. */
  today: string;
  entries: FinanceEntry[];
  totals: FinanceTotals;
}

type EntryRow = Database["public"]["Tables"]["finance_entries"]["Row"];

function mapEntry(row: EntryRow): FinanceEntry {
  return {
    id: row.id,
    kind: row.kind,
    direction: row.kind === "revenue" ? "in" : "out",
    category: row.category,
    description: row.description,
    counterparty: row.counterparty,
    amountCents: Number(row.amount_cents),
    occurredOn: row.occurred_on,
    dueOn: row.due_on,
    status: row.status,
    paidOn: row.paid_on,
    paymentMethod: row.payment_method,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

/** Primeiro e último dia da competência, para o recorte da query. */
export function monthBounds(key: string): { first: string; last: string } {
  const { year, monthIndex } = parseMonthKey(key);
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return { first: `${key}-01`, last: `${key}-${String(lastDay).padStart(2, "0")}` };
}

export function shiftMonth(key: string, delta: number): string {
  const { year, monthIndex } = parseMonthKey(key);
  return formatInTimeZone(monthAnchor(year, monthIndex + delta), TZ, "yyyy-MM");
}

function emptyTotals(): FinanceTotals {
  return {
    revenueCents: 0,
    expenseCents: 0,
    netCents: 0,
    revenuePaidCents: 0,
    expensePaidCents: 0,
    revenueOpenCents: 0,
    expenseOpenCents: 0,
    revenueOverdueCents: 0,
    expenseOverdueCents: 0,
    revenueCount: 0,
    expenseCount: 0,
  };
}

/** Soma o mês numa passada só: a lista já está na memória. */
function summarize(entries: FinanceEntry[], today: string): FinanceTotals {
  const totals = emptyTotals();

  for (const entry of entries) {
    const incoming = entry.direction === "in";
    const open = entry.status === "pending";
    const overdue = open && entry.dueOn < today;

    if (incoming) {
      totals.revenueCents += entry.amountCents;
      totals.revenueCount += 1;
      if (open) totals.revenueOpenCents += entry.amountCents;
      else totals.revenuePaidCents += entry.amountCents;
      if (overdue) totals.revenueOverdueCents += entry.amountCents;
    } else {
      totals.expenseCents += entry.amountCents;
      totals.expenseCount += 1;
      if (open) totals.expenseOpenCents += entry.amountCents;
      else totals.expensePaidCents += entry.amountCents;
      if (overdue) totals.expenseOverdueCents += entry.amountCents;
    }
  }

  totals.netCents = totals.revenueCents - totals.expenseCents;
  return totals;
}

/**
 * Lançamentos de uma competência, do vencimento mais próximo ao mais
 * distante — a ordem em que a escola cobra e paga.
 *
 * Client service-role pelo mesmo contrato do resto do arquivo: a página
 * chamadora já passou por `requireRole(["admin"])` e a query é escopada por
 * `organization_id`.
 */
export async function getFinanceMonth(
  organizationId: string,
  monthKey: string,
): Promise<FinanceMonth> {
  const admin = createAdminSupabaseClient();
  const { first, last } = monthBounds(monthKey);

  const { data } = await admin
    .from("finance_entries")
    .select("*")
    .eq("organization_id", organizationId)
    .gte("occurred_on", first)
    .lte("occurred_on", last)
    .order("due_on", { ascending: true })
    .order("created_at", { ascending: true });

  const entries = (data ?? []).map(mapEntry);
  const today = todayInSchoolTz();

  return {
    key: monthKey,
    title: monthTitle(monthKey),
    previousKey: shiftMonth(monthKey, -1),
    nextKey: shiftMonth(monthKey, 1),
    today,
    entries,
    totals: summarize(entries, today),
  };
}

/**
 * Resultado dos meses anteriores, para a faixa de tendência acima da lista.
 * São só os totais — quem olha tendência não vai abrir doze listas.
 */
export interface FinanceTrendPoint {
  key: string;
  /** `ago` — rótulo curto do eixo. */
  label: string;
  revenueCents: number;
  expenseCents: number;
  netCents: number;
}

export async function getFinanceTrend(
  organizationId: string,
  endKey: string,
  months = 6,
): Promise<FinanceTrendPoint[]> {
  const admin = createAdminSupabaseClient();
  const startKey = shiftMonth(endKey, -(months - 1));

  const { data } = await admin
    .from("finance_entries")
    .select("kind, amount_cents, occurred_on")
    .eq("organization_id", organizationId)
    .gte("occurred_on", `${startKey}-01`)
    .lte("occurred_on", monthBounds(endKey).last);

  const buckets = new Map<string, { revenueCents: number; expenseCents: number }>();
  for (const row of data ?? []) {
    const key = row.occurred_on.slice(0, 7);
    const bucket = buckets.get(key) ?? { revenueCents: 0, expenseCents: 0 };
    const amount = Number(row.amount_cents);
    if (row.kind === "revenue") bucket.revenueCents += amount;
    else bucket.expenseCents += amount;
    buckets.set(key, bucket);
  }

  return Array.from({ length: months }, (_, index) => {
    const key = shiftMonth(startKey, index);
    const bucket = buckets.get(key) ?? { revenueCents: 0, expenseCents: 0 };
    return {
      key,
      label: monthLabel(key, "LLL"),
      revenueCents: bucket.revenueCents,
      expenseCents: bucket.expenseCents,
      netCents: bucket.revenueCents - bucket.expenseCents,
    };
  });
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

export interface FinanceEntryWrite {
  kind: FinanceKind;
  category: string;
  description: string;
  counterparty?: string | undefined;
  amountCents: number;
  occurredOn: string;
  dueOn: string;
  status: FinanceStatus;
  paidOn?: string | undefined;
  paymentMethod?: PaymentMethod | undefined;
  notes?: string | undefined;
}

/** Colunas comuns a insert e update: o mapeamento mora num lugar só. */
function toRow(input: FinanceEntryWrite) {
  return {
    kind: input.kind,
    category: input.category,
    description: input.description,
    counterparty: input.counterparty ?? null,
    amount_cents: input.amountCents,
    occurred_on: input.occurredOn,
    due_on: input.dueOn,
    status: input.status,
    // O check do banco exige o par: pago tem data de baixa, pendente não tem.
    paid_on: input.status === "paid" ? (input.paidOn ?? input.dueOn) : null,
    payment_method: input.paymentMethod ?? null,
    notes: input.notes ?? null,
  };
}

export async function createFinanceEntry(
  organizationId: string,
  createdBy: string,
  input: FinanceEntryWrite,
): Promise<string | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("finance_entries")
    .insert({ organization_id: organizationId, created_by: createdBy, ...toRow(input) })
    .select("id")
    .single();

  if (error || !data) return null;
  return data.id;
}

/** O `eq("organization_id")` é o que impede um id de outra escola de ser tocado. */
export async function updateFinanceEntry(
  organizationId: string,
  entryId: string,
  input: FinanceEntryWrite,
): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("finance_entries")
    .update(toRow(input))
    .eq("id", entryId)
    .eq("organization_id", organizationId);

  return !error;
}

/**
 * Baixa (ou estorno) de um lançamento. É a ação mais repetida da tela — dar a
 * ela um caminho próprio evita reenviar o formulário inteiro só para dizer
 * que o dinheiro entrou.
 */
export async function setFinanceEntryStatus(
  organizationId: string,
  entryId: string,
  status: FinanceStatus,
  options: { paidOn?: string; paymentMethod?: PaymentMethod | null } = {},
): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const patch =
    status === "paid"
      ? {
          status,
          paid_on: options.paidOn ?? todayInSchoolTz(),
          ...(options.paymentMethod !== undefined
            ? { payment_method: options.paymentMethod }
            : {}),
        }
      : { status, paid_on: null };

  const { error } = await admin
    .from("finance_entries")
    .update(patch)
    .eq("id", entryId)
    .eq("organization_id", organizationId);

  return !error;
}

export async function getFinanceEntry(
  organizationId: string,
  entryId: string,
): Promise<FinanceEntry | null> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("finance_entries")
    .select("*")
    .eq("id", entryId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  return data ? mapEntry(data) : null;
}

export async function deleteFinanceEntry(
  organizationId: string,
  entryId: string,
): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("finance_entries")
    .delete()
    .eq("id", entryId)
    .eq("organization_id", organizationId);

  return !error;
}
