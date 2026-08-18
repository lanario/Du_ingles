import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { getAdminReport } from "@/repositories/reports";

function csvEscape(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  await requireRole(["admin"]);
  const report = await getAdminReport();

  const lines: string[] = [];
  lines.push("Turma,Professor,Frequência (%),Conclusão de tarefas (%)");
  for (const g of report.groups) {
    lines.push(
      [
        csvEscape(g.groupName),
        csvEscape(g.teacherName),
        csvEscape(g.attendanceRate ?? ""),
        csvEscape(g.assignmentCompletionRate ?? ""),
      ].join(","),
    );
  }
  lines.push("");
  lines.push("Aluno,Turma,Frequência (%)");
  for (const s of report.studentsAtRisk) {
    lines.push(
      [
        csvEscape(s.studentName),
        csvEscape(s.groupName),
        csvEscape(s.attendanceRate),
      ].join(","),
    );
  }

  const csv = "﻿" + lines.join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="relatorio-du-ingles-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
