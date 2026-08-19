import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import {
  currentMonthKey,
  getFinanceMonth,
  getFinanceTrend,
} from "@/repositories/finance";
import { monthKeySchema } from "@/schemas/finance";
import { FinanceView } from "@/components/features/admin/finance/finance-view";

export const metadata: Metadata = { title: "Financeiro" };

interface PageProps {
  searchParams: Promise<{ mes?: string }>;
}

/**
 * Livro-caixa da escola, uma competência por vez.
 *
 * A competência vem da URL (`?mes=2026-08`) e é validada antes de virar
 * query: `mes` chega de fora, e um mês inválido tem de cair no mês corrente,
 * não em uma consulta com string arbitrária.
 *
 * As duas leituras vão em paralelo — a lista do mês e a tendência dos últimos
 * seis meses aparecem juntas ou não aparecem; encadeá-las só somaria latência.
 */
export default async function FinanceiroPage({ searchParams }: PageProps) {
  const ctx = await requireRole(["admin"]);

  const { mes } = await searchParams;
  const parsed = monthKeySchema.safeParse(mes ?? "");
  const currentKey = currentMonthKey();
  const monthKey = parsed.success ? parsed.data : currentKey;

  const [month, trend] = await Promise.all([
    getFinanceMonth(ctx.organizationId, monthKey),
    getFinanceTrend(ctx.organizationId, monthKey, 6),
  ]);

  return <FinanceView month={month} trend={trend} currentKey={currentKey} />;
}
