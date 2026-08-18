import type { Metadata } from "next";
import Link from "next/link";
import { getSessionContext } from "@/lib/auth/session";
import { listMyUpcomingSessions } from "@/repositories/class-sessions";

export const metadata: Metadata = { title: "Início" };

export default async function DashboardPage() {
  const ctx = await getSessionContext();
  const sessions = await listMyUpcomingSessions(5);
  const isTeacher = ctx?.effectiveRole === "teacher";

  return (
    <div>
      <h1 className="text-2xl font-semibold">
        {isTeacher ? "Painel do Professor" : "Painel do Aluno"}
      </h1>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {isTeacher ? "Agenda" : "Próximas aulas"}
        </h2>

        {sessions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
            {isTeacher
              ? "Nenhuma aula agendada. Crie uma turma no painel admin para começar."
              : "Nenhuma aula agendada ainda."}
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {sessions.map((s) => {
              const row = (
                <div className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">{s.groupName}</p>
                    <p className="text-muted-foreground">
                      {new Date(s.scheduledAt).toLocaleString("pt-BR", {
                        weekday: "long",
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span className="text-muted-foreground">{s.durationMinutes} min</span>
                </div>
              );
              return (
                <li key={s.id}>
                  {isTeacher ? (
                    <Link href={`/aula/${s.id}`} className="block hover:bg-muted">
                      {row}
                    </Link>
                  ) : (
                    row
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
