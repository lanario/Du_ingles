import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { listMyGroups } from "@/repositories/groups";
import { listGroupAssignments, listStudentAssignments } from "@/repositories/assignments";
import { CreateAssignmentForm } from "@/components/features/assignments/create-assignment-form";
import { StudentAssignments } from "@/components/features/assignments/student-assignments";

export const metadata: Metadata = { title: "Tarefas" };

interface PageProps {
  searchParams: Promise<{ turma?: string }>;
}

export default async function TarefasPage({ searchParams }: PageProps) {
  const ctx = await requireRole(["teacher", "student"]);

  if (ctx.effectiveRole === "student") {
    const assignments = await listStudentAssignments(ctx.userId);
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">Tarefas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Responda aqui mesmo. O que venceu aparece primeiro.
          </p>
        </div>
        <StudentAssignments assignments={assignments} />
      </div>
    );
  }

  const { turma } = await searchParams;
  const groups = await listMyGroups(ctx.userId);
  const selectedGroupId = turma ?? groups[0]?.id;
  const assignments = selectedGroupId ? await listGroupAssignments(selectedGroupId) : [];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-navy-900">Tarefas</h1>

      {groups.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
          Você ainda não tem turmas atribuídas.
        </p>
      ) : (
        <div className="mt-8 space-y-10">
          <section className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <Link
                key={g.id}
                href={`/tarefas?turma=${g.id}`}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  g.id === selectedGroupId
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                {g.name}
              </Link>
            ))}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Tarefas da turma
            </h2>
            {assignments.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
                Nenhuma tarefa criada para essa turma ainda.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {assignments.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/tarefas/${a.id}`}
                      className="flex items-center justify-between px-4 py-3 text-sm hover:bg-muted"
                    >
                      <span className="font-medium">{a.title}</span>
                      {a.dueAt && (
                        <span className="text-muted-foreground">
                          até {new Date(a.dueAt).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Nova tarefa
            </h2>
            <CreateAssignmentForm groups={groups} defaultGroupId={selectedGroupId} />
          </section>
        </div>
      )}
    </div>
  );
}
