import type { Metadata } from "next";
import { getAdminReport } from "@/repositories/reports";

export const metadata: Metadata = { title: "Relatórios" };

export default async function RelatoriosPage() {
  const report = await getAdminReport();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Relatórios</h1>
        <a
          href="/api/relatorios/export"
          className="rounded-md border border-admin-border px-4 py-2 text-sm hover:bg-admin-muted"
        >
          Baixar CSV
        </a>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-admin-foreground/60">
          Frequência e conclusão de tarefas por turma
        </h2>
        {report.groups.length === 0 ? (
          <p className="rounded-lg border border-dashed border-admin-border p-8 text-center text-admin-foreground/70">
            Nenhuma turma ativa.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-admin-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-admin-border text-left text-admin-foreground/60">
                  <th className="px-4 py-3 font-medium">Turma</th>
                  <th className="px-4 py-3 font-medium">Professor</th>
                  <th className="px-4 py-3 font-medium">Frequência</th>
                  <th className="px-4 py-3 font-medium">Tarefas concluídas</th>
                </tr>
              </thead>
              <tbody>
                {report.groups.map((g) => (
                  <tr
                    key={g.groupId}
                    className="border-b border-admin-border last:border-0"
                  >
                    <td className="px-4 py-3">{g.groupName}</td>
                    <td className="px-4 py-3 text-admin-foreground/70">
                      {g.teacherName}
                    </td>
                    <td className="px-4 py-3">
                      {g.attendanceRate != null ? `${g.attendanceRate}%` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {g.assignmentCompletionRate != null
                        ? `${g.assignmentCompletionRate}%`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-admin-foreground/60">
          Alunos em risco (frequência abaixo de 75%)
        </h2>
        {report.studentsAtRisk.length === 0 ? (
          <p className="rounded-lg border border-dashed border-admin-border p-8 text-center text-admin-foreground/70">
            Nenhum aluno em risco no momento.
          </p>
        ) : (
          <ul className="divide-y divide-admin-border rounded-lg border border-admin-border">
            {report.studentsAtRisk.map((s) => (
              <li
                key={`${s.studentId}-${s.groupName}`}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{s.studentName}</p>
                  <p className="text-admin-foreground/60">{s.groupName}</p>
                </div>
                <span className="font-medium text-admin-accent">{s.attendanceRate}%</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10 grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-admin-foreground/60">
            Aulas ministradas por professor
          </h2>
          {report.teacherSessions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-admin-border p-6 text-center text-admin-foreground/70">
              Nenhuma aula concluída ainda.
            </p>
          ) : (
            <ul className="divide-y divide-admin-border rounded-lg border border-admin-border">
              {report.teacherSessions.map((t) => (
                <li
                  key={t.teacherId}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <span>{t.teacherName}</span>
                  <span className="text-admin-foreground/70">
                    {t.sessionsCompleted} aulas · {Math.round(t.totalMinutes / 60)}h
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-admin-foreground/60">
            Distribuição de nível dos alunos
          </h2>
          {report.levelDistribution.length === 0 ? (
            <p className="rounded-lg border border-dashed border-admin-border p-6 text-center text-admin-foreground/70">
              Nenhum aluno cadastrado.
            </p>
          ) : (
            <ul className="divide-y divide-admin-border rounded-lg border border-admin-border">
              {report.levelDistribution.map((l) => (
                <li
                  key={l.level}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <span>{l.level}</span>
                  <span className="text-admin-foreground/70">{l.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
