import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { getAssignmentById, getAssignmentSubmissions } from "@/repositories/assignments";
import { SubmitAssignmentForm } from "@/components/features/assignments/submit-assignment-form";
import { GradeSubmissionForm } from "@/components/features/assignments/grade-submission-form";
import { StatusPill } from "@/components/features/assignments/status-pill";
import { CalendarIcon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Tarefa" };

interface PageProps {
  params: Promise<{ id: string }>;
}

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
      <p className="text-sm font-medium uppercase tracking-wide text-gold-600">
        {assignment.groupName}
      </p>
      <h1 className="mt-1 text-2xl font-semibold text-navy-900">{assignment.title}</h1>
      {(assignment.maxScore != null || assignment.dueAt) && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {assignment.maxScore != null && <span>Nota máxima: {assignment.maxScore}</span>}
          {assignment.dueAt && (
            <span className="flex items-center gap-1.5">
              <CalendarIcon className="h-4 w-4" />
              Prazo: {new Date(assignment.dueAt).toLocaleDateString("pt-BR")}
            </span>
          )}
        </div>
      )}

      {ctx.effectiveRole === "teacher" ? (
        <section className="mt-8 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Respostas ({submissions.length})
          </h2>
          {submissions.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-muted/40 p-8 text-center text-muted-foreground">
              Nenhum aluno enviou resposta ainda.
            </p>
          ) : (
            submissions.map((s) => (
              <div
                key={s.studentId}
                className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-card)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-navy-900">{s.studentName}</p>
                  <StatusPill status={s.status} />
                </div>
                {s.content && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/80">
                    {s.content}
                  </p>
                )}
                {s.status !== "pending" && (
                  <div className="mt-4 border-t border-border pt-4">
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
                <div className="space-y-3 rounded-2xl border border-border bg-background p-5 shadow-[var(--shadow-card)]">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-lg font-semibold text-navy-900">
                      Nota: {mine.score}
                      {assignment.maxScore ? ` / ${assignment.maxScore}` : ""}
                    </p>
                    <StatusPill status={mine.status} />
                  </div>
                  {mine.feedback && (
                    <p className="rounded-xl bg-muted/60 p-3 text-sm text-foreground/80">
                      {mine.feedback}
                    </p>
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
