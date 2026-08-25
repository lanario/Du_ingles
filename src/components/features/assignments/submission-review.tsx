/**
 * A tela de correção — a mesma para o professor da turma e para o admin no
 * planejador; só muda qual server action fecha a nota.
 *
 * É um componente de servidor de propósito: a correção automática precisa do
 * gabarito, e o gabarito não pode existir no bundle do cliente. Quem chama já
 * confirmou que este usuário pode corrigir esta tarefa (ver
 * `getAssignmentAnswerKey`) — aqui só se desenha o resultado.
 */

import {
  autoGrade,
  suggestedScore,
  type AnswerKey,
  type Question,
} from "@/lib/assignments/exercises";
import { StatusPill } from "@/components/features/assignments/status-pill";
import { GradeSubmissionForm } from "@/components/features/assignments/grade-submission-form";
import { AnswerText } from "@/components/features/assignments/student-answers-view";
import { CheckIcon, CloseIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { SubmissionRow } from "@/repositories/assignments";

export function SubmissionReview({
  assignmentId,
  questions,
  answerKey,
  maxScore,
  submissions,
  variant = "teacher",
}: {
  assignmentId: string;
  questions: Question[];
  answerKey: AnswerKey;
  maxScore: number | null;
  submissions: SubmissionRow[];
  variant?: "teacher" | "admin";
}) {
  if (submissions.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-muted/40 p-8 text-center text-muted-foreground">
        Nenhum aluno enviou resposta ainda.
      </p>
    );
  }

  // Quem entregou e ainda não tem nota vem primeiro: é a fila de trabalho.
  const ordered = [...submissions].sort((a, b) => {
    const rank = (s: SubmissionRow) =>
      s.status === "submitted" ? 0 : s.status === "graded" ? 2 : 1;
    return rank(a) - rank(b) || a.studentName.localeCompare(b.studentName, "pt-BR");
  });

  return (
    <div className="space-y-4">
      {ordered.map((submission) => {
        const auto = autoGrade(questions, answerKey, submission.answers);
        const suggestion = suggestedScore(auto, maxScore);

        return (
          <article
            key={submission.studentId}
            className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-card)] sm:p-5"
          >
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-navy-900">
                  {submission.studentName}
                </p>
                {submission.submittedAt && (
                  <p className="text-xs text-muted-foreground">
                    Entregue em{" "}
                    {new Date(submission.submittedAt).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {auto.max > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
                      auto.score === auto.max
                        ? "bg-success/10 text-success ring-success/30"
                        : "bg-navy-50 text-navy-700 ring-navy-100",
                    )}
                    title="Acertos nas questões objetivas — só você vê isto"
                  >
                    {auto.score}/{auto.max} objetivas
                  </span>
                )}
                <StatusPill status={submission.status} />
              </div>
            </header>

            {questions.length > 0 ? (
              <ol className="mt-4 space-y-2.5">
                {questions.map((question, index) => {
                  const verdict = auto.verdicts[question.id];
                  return (
                    <li key={question.id} className="flex items-start gap-2.5">
                      <VerdictBadge verdict={verdict} index={index} />
                      <div className="min-w-0 flex-1">
                        <p className="whitespace-pre-wrap text-sm text-foreground/75">
                          {question.prompt}
                        </p>
                        <AnswerText
                          question={question}
                          raw={submission.answers[question.id] ?? ""}
                        />
                        {verdict === null && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Vale {question.points} pt · corrija você
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              submission.content && (
                <p className="mt-3 whitespace-pre-wrap rounded-xl bg-muted/50 p-3 text-sm text-foreground/80">
                  {submission.content}
                </p>
              )
            )}

            {submission.status !== "pending" && (
              <div className="mt-4 border-t border-border pt-4">
                <GradeSubmissionForm
                  assignmentId={assignmentId}
                  studentId={submission.studentId}
                  maxScore={maxScore}
                  initialScore={submission.score}
                  initialFeedback={submission.feedback}
                  suggestedScore={suggestion}
                  variant={variant}
                />
              </div>
            )}

            {submission.status === "pending" && (
              <p className="mt-3 rounded-xl bg-gold-50 px-3 py-2 text-xs text-gold-700">
                Rascunho em andamento — a nota abre quando o aluno enviar.
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}

function VerdictBadge({
  verdict,
  index,
}: {
  verdict: boolean | null | undefined;
  index: number;
}) {
  if (verdict === true) {
    return (
      <span
        className="grid h-6 w-6 flex-none place-items-center rounded-lg bg-success/15 text-success"
        title="Correta"
      >
        <CheckIcon className="h-3.5 w-3.5" />
      </span>
    );
  }

  if (verdict === false) {
    return (
      <span
        className="grid h-6 w-6 flex-none place-items-center rounded-lg bg-destructive/10 text-destructive"
        title="Incorreta"
      >
        <CloseIcon className="h-3.5 w-3.5" />
      </span>
    );
  }

  return (
    <span
      className="grid h-6 w-6 flex-none place-items-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground"
      title="Sem correção automática"
    >
      {index + 1}
    </span>
  );
}
