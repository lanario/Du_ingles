import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { getAdminReport } from "@/repositories/reports";
import { currentMonthKey } from "@/repositories/finance";
import {
  getFinancialReport,
  type FinancialReport,
} from "@/repositories/financial-reports";
import { DEFAULT_REPORT_WINDOW, isReportWindow, type ReportWindow } from "@/schemas/reports";
import { monthKeySchema } from "@/schemas/finance";

/**
 * Exportação do relatório. O `escopo` espelha a aba aberta na tela — quem
 * pede o CSV está olhando uma leitura específica, e devolver as quatro
 * sempre transformaria a planilha num despejo que ninguém abre.
 *
 * Valores saem em reais com vírgula decimal e as colunas são separadas por
 * ponto e vírgula: é o que o Excel em pt-BR abre sem passar pelo assistente
 * de importação.
 */

type Scope = "overview" | "students" | "teachers" | "pedagogy";

const SCOPES: Scope[] = ["overview", "students", "teachers", "pedagogy"];

function csvEscape(value: string | number): string {
  const text = String(value);
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function row(cells: (string | number)[]): string {
  return cells.map(csvEscape).join(";");
}

/** Centavos → `1234,50`, sem símbolo: a planilha soma, não exibe. */
function money(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function percent(ratio: number | null): string {
  return ratio == null ? "" : (ratio * 100).toFixed(1).replace(".", ",");
}

function overviewLines(report: FinancialReport): string[] {
  const lines = [
    row(["Competência", "Receitas", "Custo com professores", "Estrutura", "Despesas", "Resultado"]),
  ];

  for (const point of report.series) {
    lines.push(
      row([
        point.title,
        money(point.revenueCents),
        money(point.professionalCostCents),
        money(point.operatingExpenseCents),
        money(point.expenseCents),
        money(point.netCents),
      ]),
    );
  }

  lines.push("");
  lines.push(row([`Categorias de ${report.monthTitle}`]));
  lines.push(row(["Tipo", "Categoria", "Valor", "Participação (%)", "Lançamentos"]));
  for (const slice of report.revenueCategories) {
    lines.push(
      row(["Receita", slice.label, money(slice.cents), percent(slice.share), slice.count]),
    );
  }
  for (const slice of report.expenseCategories) {
    lines.push(
      row(["Despesa", slice.label, money(slice.cents), percent(slice.share), slice.count]),
    );
  }

  return lines;
}

function studentLines(report: FinancialReport): string[] {
  const lines = [
    row([
      "Aluno",
      "Plano",
      "Total",
      "Recebido",
      "Em aberto",
      "Vencido",
      "Lançamentos",
      "Participação (%)",
      "Última baixa",
    ]),
  ];

  for (const student of report.students) {
    lines.push(
      row([
        student.name,
        student.planName ?? "",
        money(student.cents),
        money(student.paidCents),
        money(student.openCents),
        money(student.overdueCents),
        student.count,
        percent(student.share),
        student.lastPaidOn ?? "",
      ]),
    );
  }

  return lines;
}

function teacherLines(report: FinancialReport): string[] {
  const lines = [
    row([
      "Professor",
      "Aulas",
      "Horas",
      "Custo lançado",
      "Pago",
      "A pagar",
      "Custo por aula",
      "Custo por hora",
      "Previsto (valor-hora)",
      "Participação na folha (%)",
    ]),
  ];

  for (const teacher of report.teachers) {
    lines.push(
      row([
        teacher.name,
        teacher.sessions,
        (teacher.minutes / 60).toFixed(1).replace(".", ","),
        money(teacher.cents),
        money(teacher.paidCents),
        money(teacher.openCents),
        teacher.costPerSessionCents == null ? "" : money(teacher.costPerSessionCents),
        teacher.costPerHourCents == null ? "" : money(teacher.costPerHourCents),
        teacher.estimatedCents == null ? "" : money(teacher.estimatedCents),
        percent(teacher.share),
      ]),
    );
  }

  return lines;
}

async function pedagogyLines(): Promise<string[]> {
  const report = await getAdminReport();
  const lines = [row(["Turma", "Professor", "Frequência (%)", "Conclusão de tarefas (%)"])];

  for (const group of report.groups) {
    lines.push(
      row([
        group.groupName,
        group.teacherName,
        group.attendanceRate ?? "",
        group.assignmentCompletionRate ?? "",
      ]),
    );
  }

  lines.push("");
  lines.push(row(["Aluno em risco", "Turma", "Frequência (%)"]));
  for (const student of report.studentsAtRisk) {
    lines.push(row([student.studentName, student.groupName, student.attendanceRate]));
  }

  lines.push("");
  lines.push(row(["Professor", "Aulas concluídas", "Horas"]));
  for (const teacher of report.teacherSessions) {
    lines.push(
      row([
        teacher.teacherName,
        teacher.sessionsCompleted,
        Math.round(teacher.totalMinutes / 60),
      ]),
    );
  }

  return lines;
}

const FILE_SUFFIX: Record<Scope, string> = {
  overview: "receitas-despesas",
  students: "receita-por-aluno",
  teachers: "professores",
  pedagogy: "pedagogico",
};

export async function GET(request: Request) {
  const ctx = await requireRole(["admin"]);

  const params = new URL(request.url).searchParams;
  const rawScope = params.get("escopo") ?? "overview";
  const scope: Scope = SCOPES.includes(rawScope as Scope) ? (rawScope as Scope) : "overview";

  const parsedMonth = monthKeySchema.safeParse(params.get("mes") ?? "");
  const monthKey = parsedMonth.success ? parsedMonth.data : currentMonthKey();
  const janela = Number(params.get("janela"));
  const windowMonths: ReportWindow = isReportWindow(janela)
    ? janela
    : DEFAULT_REPORT_WINDOW;

  let lines: string[];
  let title: string;

  if (scope === "pedagogy") {
    lines = await pedagogyLines();
    title = "Relatório pedagógico";
  } else {
    const report = await getFinancialReport(ctx.organizationId, monthKey, windowMonths);
    lines =
      scope === "students"
        ? studentLines(report)
        : scope === "teachers"
          ? teacherLines(report)
          : overviewLines(report);
    title = `${
      scope === "students"
        ? "Receita por aluno"
        : scope === "teachers"
          ? "Comissão e salário de professores"
          : "Receitas e despesas"
    } — ${report.monthTitle}`;
  }

  // BOM na frente: sem ele o Excel abre os acentos como mojibake.
  const csv = "﻿" + [row([title]), "", ...lines].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="relatorio-${FILE_SUFFIX[scope]}-${monthKey}.csv"`,
    },
  });
}
