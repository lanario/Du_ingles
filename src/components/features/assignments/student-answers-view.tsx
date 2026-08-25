/**
 * O que o aluno vê depois de entregar: as próprias respostas, em modo leitura.
 *
 * Sem marcação de certo/errado por questão — de propósito. A correção
 * automática existe, mas é prévia para o professor; o aluno recebe o resultado
 * quando o professor fecha a nota, junto do comentário dele. O gabarito nem
 * chega a este processo (`answer_key` está fora do SELECT do aluno), então não
 * há como esta tela vazar resposta certa nem por engano.
 */

import { optionLabel, type Question, type StudentAnswers } from "@/lib/assignments/exercises";
import { cn } from "@/lib/utils";

export function StudentAnswersView({
  questions,
  answers,
}: {
  questions: Question[];
  answers: StudentAnswers;
}) {
  return (
    <ol className="space-y-3">
      {questions.map((question, index) => {
        const raw = answers[question.id] ?? "";
        return (
          <li
            key={question.id}
            className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-card)]"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-navy-900">
                  {question.prompt}
                </p>
                <AnswerText question={question} raw={raw} />
              </div>
              <span className="flex-none text-xs text-muted-foreground">
                {question.points} pt
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function AnswerText({ question, raw }: { question: Question; raw: string }) {
  let shown = raw;

  if (question.type === "multiple_choice") {
    const picked = Number(raw);
    shown = Number.isInteger(picked)
      ? `${optionLabel(picked)}. ${question.options?.[picked] ?? ""}`.trim()
      : "";
  } else if (question.type === "true_false") {
    shown = raw === "true" ? "Verdadeiro" : raw === "false" ? "Falso" : "";
  }

  const empty = shown.trim() === "";

  return (
    <p
      className={cn(
        "mt-2 whitespace-pre-wrap rounded-xl px-3 py-2 text-sm",
        empty
          ? "bg-muted/50 italic text-muted-foreground"
          : "bg-navy-50/70 text-navy-900",
      )}
    >
      {empty ? "Sem resposta" : shown}
    </p>
  );
}
