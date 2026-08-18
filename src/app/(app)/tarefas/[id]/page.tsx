import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { getAssignmentById, getAssignmentSubmissions } from "@/repositories/assignments";
import { SubmitAssignmentForm } from "@/components/features/assignments/submit-assignment-form";
import { GradeSubmissionForm } from "@/components/features/assignments/grade-submission-form";

export const metadata: Metadata = { title: "Tarefa" };

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  submitted: "Enviada",
  graded: "Corrigida",
  late: "Atrasada",
};

export default async function TarefaDetailPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await requireRole(["teacher", "student"]);

  // getAssignmentById respeita RLS (assignments_select_teacher /
  // assignments_select_student) — linha nula aqui já é "sem acesso".
  const assignment = await getAssignmentById(id);
  if (!assignment) notFound();

  const submissions = await getAssignmentSubmissions(id);

  return (
    <div className="max-w-2xl">
      <p className="text-sm text-muted-foreground">{assignment.groupName}</p>
      <h1 className="text-2xl font-semibold">{assignment.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {assignment.maxScore != null && `Nota máxima: ${assignment.maxScore}`}
        {assignment.dueAt &&
          ` · Prazo: ${new Date(assignment.dueAt).toLocaleDateString("pt-BR")}`}
      </p>

      {ctx.effectiveRole === "teacher" ? (
        <section className="mt-8 space-y-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Respostas ({submissions.length})
          </h2>
          {submissions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
              Nenhum aluno enviou resposta ainda.
            </p>
          ) : (
            submissions.map((s) => (
              <div key={s.studentId} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{s.studentName}</p>
                  <span className="text-sm text-muted-foreground">
                    {STATUS_LABEL[s.status]}
                  </span>
                </div>
                {s.content && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/80">
                    {s.content}
                  </p>
                )}
                {s.status !== "pending" && (
                  <div className="mt-4">
                    <GradeSubmissionForm
                      assignmentId={id}
                      studentId={s.studentId}
                      maxScore={assignment.maxScore}
                      initialScore={s.score}
                      initialFeedback={s.feedback}
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </section>
      ) : (
        <section className="mt-8">
          {(() => {
            const mine = submissions[0];
            if (mine?.status === "graded") {
              return (
                <div className="space-y-2 rounded-lg border border-border p-4">
                  <p className="text-sm font-semibold">
                    Nota: {mine.score}{" "}
                    {assignment.maxScore ? `/ ${assignment.maxScore}` : ""}
                  </p>
                  {mine.feedback && (
                    <p className="text-sm text-foreground/80">{mine.feedback}</p>
                  )}
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {mine.content}
                  </p>
                </div>
              );
            }
            return (
              <SubmitAssignmentForm
                assignmentId={id}
                initialContent={mine?.content ?? undefined}
              />
            );
          })()}
        </section>
      )}
    </div>
  );
}
