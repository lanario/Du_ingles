import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { getStudentProgress } from "@/repositories/progress";

export const metadata: Metadata = { title: "Meu progresso" };

export default async function ProgressoPage() {
  const ctx = await requireRole(["student"]);
  const progress = await getStudentProgress(ctx.userId);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Meu progresso</h1>

      <div className="mt-8 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Nível atual</p>
          <p className="mt-1 text-2xl font-semibold">{progress.currentLevel ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Aulas concluídas</p>
          <p className="mt-1 text-2xl font-semibold">{progress.completedSessions}</p>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Frequência por turma
        </h2>
        {progress.groups.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">
            Nenhuma matrícula ativa.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {progress.groups.map((g) => (
              <li
                key={g.groupId}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <span>{g.groupName}</span>
                <span
                  className={g.attendanceRate < 75 ? "font-medium text-destructive" : ""}
                >
                  {g.attendanceRate.toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Notas de tarefas
        </h2>
        {progress.grades.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">
            Nenhuma tarefa corrigida ainda.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {progress.grades.map((g, i) => (
              <li key={i} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{g.title}</p>
                  <p className="text-muted-foreground">{g.groupName}</p>
                </div>
                <span>
                  {g.score} {g.maxScore ? `/ ${g.maxScore}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
