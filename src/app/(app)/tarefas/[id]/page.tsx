import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import {
  getAssignmentAnswerKey,
  getAssignmentById,
  getAssignmentSubmissions,
  getMySubmission,
} from "@/repositories/assignments";
import { SubmitAssignmentForm } from "@/components/features/assignments/submit-assignment-form";
import { ExercisePlayer } from "@/components/features/assignments/exercise-player";
import { StudentAnswersView } from "@/components/features/assignments/student-answers-view";
import { SubmissionReview } from "@/components/features/assignments/submission-review";
import { StatusPill } from "@/components/features/assignments/status-pill";
import { ArrowLeftIcon, CalendarIcon, TaskIcon } from "@/components/ui/icons";

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

  const overdue = assignment.dueAt ? new Date(assignment.dueAt) < new Date() : false;

  const header = (
    <header>
      <Link
        href="/tarefas"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-navy-900"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Tarefas
      </Link>

      <p className="mt-4 text-sm font-medium uppercase tracking-wide text-gold-600">
        {assignment.groupName}
      </p>
      <h1 className="mt-1 text-2xl font-semibold text-navy-900">{assignment.title}</h1>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
        {assignment.questions.length > 0 && (
          <span className="flex items-center gap-1.5">
            <TaskIcon className="h-4 w-4" />
            {assignment.questions.length} quest
            {assignment.questions.length === 1 ? "ão" : "ões"}
          </span>
        )}
        {assignment.maxScore != null && <span>Nota máxima: {assignment.maxScore}</span>}
        {assignment.dueAt && (
          <span
            className={
              overdue ? "flex items-center gap-1.5 font-medium text-destructive" : "flex items-center gap-1.5"
            }
          >
            <CalendarIcon className="h-4 w-4" />
            Prazo: {new Date(assignment.dueAt).toLocaleDateString("pt-BR")}
          </span>
        )}
      </div>

      {assignment.instructions && (
        <p className="mt-4 whitespace-pre-wrap rounded-2xl border border-border bg-muted/40 p-4 text-sm leading-relaxed text-foreground/80">
          {assignment.instructions}
        </p>
      )}
    </header>
  );

  // -------------------------------------------------------------------------
  // Professor: correção
  // -------------------------------------------------------------------------
  // As duas leituras abaixo usam service-role (gabarito e prévia da correção
  // ficam fora do alcance de `authenticated`), então elas só podem acontecer
  // DEPOIS de `getAssignmentById` ter voltado não-nulo por
  // `assignments_select_teacher` — é esse retorno que prova a posse da turma.
  // Nunca mova isto para fora do ramo do professor.
  if (ctx.effectiveRole === "teacher") {
    const [submissions, answerKey] = await Promise.all([
      getAssignmentSubmissions(id),
      getAssignmentAnswerKey(id),
    ]);

    return (
      <div className="max-w-3xl space-y-8">
        {header}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Respostas ({submissions.length})
          </h2>
          <SubmissionReview
            assignmentId={id}
            questions={assignment.questions}
            answerKey={answerKey}
            maxScore={assignment.maxScore}
            submissions={submissions}
          />
        </section>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Aluno: fazer a tarefa
  // -------------------------------------------------------------------------
  const mine = await getMySubmission(id, ctx.userId);
  const hasExercise = assignment.questions.length > 0;
  const sent = mine?.status === "submitted" || mine?.status === "graded";

  return (
    <div className="max-w-3xl space-y-8">
      {header}

      <section className="space-y-4">
        {mine?.status === "graded" && (
          <div className="space-y-3 rounded-2xl border border-success/30 bg-success/5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-lg font-semibold text-navy-900">
                Nota: {mine.score}
                {assignment.maxScore ? ` / ${assignment.maxScore}` : ""}
              </p>
              <StatusPill status={mine.status} />
            </div>
            {mine.feedback && (
              <p className="whitespace-pre-wrap rounded-xl bg-background/70 p-3 text-sm text-foreground/80">
                {mine.feedback}
              </p>
            )}
          </div>
        )}

        {mine?.status === "submitted" && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-navy-100 bg-navy-50/60 p-4">
            <p className="text-sm text-navy-900">
              Tarefa entregue. Assim que seu professor corrigir, a nota aparece aqui.
            </p>
            <StatusPill status={mine.status} />
          </div>
        )}

        {hasExercise ? (
          sent ? (
            <StudentAnswersView
              questions={assignment.questions}
              answers={mine?.answers ?? {}}
            />
          ) : (
            <ExercisePlayer
              assignmentId={id}
              questions={assignment.questions}
              initialAnswers={mine?.answers ?? {}}
            />
          )
        ) : sent ? (
          <p className="whitespace-pre-wrap rounded-2xl border border-border bg-muted/40 p-4 text-sm text-foreground/80">
            {mine?.content}
          </p>
        ) : (
          <SubmitAssignmentForm
            assignmentId={id}
            initialContent={mine?.content ?? undefined}
          />
        )}
      </section>
    </div>
  );
}
