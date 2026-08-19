import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import { ptBR } from "date-fns/locale";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

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
function monthLabel(key: string, pattern: string): string {
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
