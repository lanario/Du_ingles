import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { getOrganizationName } from "@/lib/organization";
import { getAdminReport } from "@/repositories/reports";
import { currentMonthKey } from "@/repositories/finance";
import { getFinancialReport } from "@/repositories/financial-reports";
import { DEFAULT_REPORT_WINDOW, isReportWindow, type ReportWindow } from "@/schemas/reports";
import { monthKeySchema } from "@/schemas/finance";
import { ReportsView } from "@/components/features/admin/reports/reports-view";

export const metadata: Metadata = { title: "Relatórios" };

/**
 * Relatório cruza a organização inteira e sempre por uma competência
 * escolhida na hora — nada aqui pode ser cacheado entre requisições.
 */
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ mes?: string; janela?: string }>;
}

/** Mês e janela vêm da URL; valor inválido cai no padrão em vez de estourar. */
function parseParams(params: { mes?: string; janela?: string }): {
  monthKey: string;
  windowMonths: ReportWindow;
} {
  const parsedMonth = monthKeySchema.safeParse(params.mes ?? "");
  const janela = Number(params.janela);

  return {
    monthKey: parsedMonth.success ? parsedMonth.data : currentMonthKey(),
    windowMonths: isReportWindow(janela) ? janela : DEFAULT_REPORT_WINDOW,
  };
}

export default async function RelatoriosPage({ searchParams }: PageProps) {
  const ctx = await requireRole(["admin"]);
  const { monthKey, windowMonths } = parseParams(await searchParams);

  const [report, pedagogy, organizationName] = await Promise.all([
    getFinancialReport(ctx.organizationId, monthKey, windowMonths),
    getAdminReport(),
    getOrganizationName(ctx.organizationId),
  ]);

  return (
    <ReportsView
      report={report}
      pedagogy={pedagogy}
      organizationName={organizationName}
    />
  );
}
