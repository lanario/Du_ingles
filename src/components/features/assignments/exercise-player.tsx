"use client";

/**
 * Onde o aluno faz a tarefa.
 *
 * Duas decisões que moldam o resto do componente:
 *
 * 1. Todas as questões ficam visíveis de uma vez, em vez de um assistente
 *    passo a passo. Tarefa de casa não é prova cronometrada — o aluno pula,
 *    volta, revisa antes de entregar; esconder o conjunto atrapalharia isso.
 *
 * 2. O rascunho salva sozinho enquanto ele digita. O aluno de celular fecha o
 *    app no meio, e perder meia hora de resposta é o tipo de coisa que faz
 *    ninguém mais abrir a aba de tarefas.
 *
 * O envio definitivo continua sendo um ato explícito, e só ele muda a
 * submissão para `submitted` e dispara a correção automática no servidor.
 */

import { useActionState, useEffect, useRef, useState } from "react";
import { submitExerciseAction } from "@/actions/student/assignments";
import {
  BLANK_TOKEN,
  optionLabel,
  type Question,
  type StudentAnswers,
} from "@/lib/assignments/exercises";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/ui/form-message";
import { CheckIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { LogoLoader } from "@/components/ui/logo-loader";

type SaveState = "idle" | "saving" | "saved" | "error";

export function ExercisePlayer({
  assignmentId,
  questions,
  initialAnswers,
}: {
  assignmentId: string;
  questions: Question[];
  initialAnswers: StudentAnswers;
}) {
  const action = submitExerciseAction.bind(null, assignmentId);
  const [state, formAction, isPending] = useActionState(action, null);
  const [answers, setAnswers] = useState<StudentAnswers>(initialAnswers);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [confirming, setConfirming] = useState(false);

  // Sem isso o autosave dispararia no primeiro render, gravando um rascunho
  // idêntico ao que já está no banco toda vez que o aluno só abre a tarefa.
  const touched = useRef(false);

  const answered = questions.filter((q) => (answers[q.id] ?? "").trim() !== "").length;
  const total = questions.length;
  const complete = answered === total;
  const progress = total === 0 ? 0 : Math.round((answered / total) * 100);

  useEffect(() => {
    if (!touched.current) return;

    setSaveState("saving");
    const timer = setTimeout(async () => {
      const payload = new FormData();
      payload.set("answers", JSON.stringify(answers));
      payload.set("draft", "1");
      const result = await submitExerciseAction(assignmentId, null, payload);
      setSaveState(result.success ? "saved" : "error");
    }, 1200);

    return () => clearTimeout(timer);
  }, [answers, assignmentId]);

  function setAnswer(questionId: string, value: string) {
    touched.current = true;
    setConfirming(false);
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="answers" value={JSON.stringify(answers)} />

      <div className="sticky top-0 z-10 -mx-1 rounded-2xl border border-border bg-background/95 px-4 py-3 shadow-[var(--shadow-card)] backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-navy-900">
            {answered} de {total} respondida{total === 1 ? "" : "s"}
          </p>
          <SaveIndicator state={saveState} />
        </div>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progresso da tarefa"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-navy-700 to-gold-500 transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {state && !state.success && (
        <FormBanner tone="error">{state.error.message}</FormBanner>
      )}
      {saveState === "error" && (
        <FormBanner tone="error">
          Não conseguimos salvar seu rascunho. Verifique sua conexão antes de enviar.
        </FormBanner>
      )}

      <ol className="space-y-3">
        {questions.map((question, index) => (
          <QuestionCard
            key={question.id}
            question={question}
            index={index}
            value={answers[question.id] ?? ""}
            onChange={(value) => setAnswer(question.id, value)}
          />
        ))}
      </ol>

      <div className="sticky bottom-0 -mx-1 rounded-2xl border border-border bg-background/95 px-4 py-3.5 shadow-[var(--shadow-card)] backdrop-blur">
        {confirming ? (
          <div className="space-y-3">
            <p className="text-sm text-foreground/80">
              Depois de enviar você não consegue mais alterar as respostas. Enviar agora?
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <span className="inline-flex items-center gap-2">
                    <LogoLoader size={16} label={null} />
                    Enviando…
                  </span>
                ) : (
                  "Sim, enviar tarefa"
                )}
              </Button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="h-10 rounded-xl border border-border px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Voltar e revisar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {complete
                ? "Tudo respondido — revise e envie."
                : `Faltam ${total - answered} quest${total - answered === 1 ? "ão" : "ões"}.`}
            </p>
            <Button type="button" disabled={!complete} onClick={() => setConfirming(true)}>
              Enviar tarefa
            </Button>
          </div>
        )}
      </div>
    </form>
  );
}

function QuestionCard({
  question,
  index,
  value,
  onChange,
}: {
  question: Question;
  index: number;
  value: string;
  onChange: (value: string) => void;
}) {
  const answered = value.trim() !== "";

  return (
    <li
      className={cn(
        "rounded-2xl border bg-background p-4 shadow-[var(--shadow-card)] transition-colors sm:p-5",
        answered ? "border-navy-200" : "border-border",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid h-7 w-7 flex-none place-items-center rounded-lg text-xs font-semibold transition-colors",
            answered ? "bg-navy-900 text-gold-400" : "bg-muted text-muted-foreground",
          )}
        >
          {answered ? <CheckIcon className="h-3.5 w-3.5" /> : index + 1}
        </span>

        <div className="min-w-0 flex-1">
          {question.type === "fill_blank" ? (
            <FillBlankPrompt question={question} value={value} onChange={onChange} />
          ) : (
            <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-navy-900">
              {question.prompt}
            </p>
          )}

          <div className="mt-3">
            {question.type === "multiple_choice" && (
              <ChoiceInput question={question} value={value} onChange={onChange} />
            )}

            {question.type === "true_false" && (
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "true", label: "Verdadeiro" },
                  { key: "false", label: "Falso" },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => onChange(option.key)}
                    aria-pressed={value === option.key}
                    className={cn(
                      "h-10 min-w-32 flex-1 rounded-xl border px-4 text-sm font-medium transition-colors sm:flex-none",
                      value === option.key
                        ? "border-navy-700 bg-navy-900 text-white"
                        : "border-border bg-background text-foreground/70 hover:border-navy-200 hover:bg-muted",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}

            {question.type === "short_text" && (
              <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                maxLength={200}
                placeholder="Sua resposta"
                aria-label={`Resposta da questão ${index + 1}`}
                className="h-11 w-full max-w-md rounded-xl border border-border bg-background px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            )}

            {question.type === "long_text" && (
              <div>
                <textarea
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  rows={5}
                  maxLength={5000}
                  placeholder="Escreva sua resposta"
                  aria-label={`Resposta da questão ${index + 1}`}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <p className="mt-1 text-right text-xs text-muted-foreground">
                  {value.length}/5000
                </p>
              </div>
            )}
          </div>
        </div>

        <span className="flex-none text-xs text-muted-foreground">
          {question.points} pt
        </span>
      </div>
    </li>
  );
}

function ChoiceInput({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      {(question.options ?? []).map((option, index) => {
        const selected = value === String(index);
        return (
          <button
            key={index}
            type="button"
            onClick={() => onChange(String(index))}
            aria-pressed={selected}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition-colors",
              selected
                ? "border-navy-700 bg-navy-50 text-navy-900"
                : "border-border bg-background text-foreground/80 hover:border-navy-200 hover:bg-muted",
            )}
          >
            <span
              className={cn(
                "grid h-7 w-7 flex-none place-items-center rounded-lg text-xs font-bold transition-colors",
                selected
                  ? "bg-navy-900 text-gold-400"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {optionLabel(index)}
            </span>
            <span className="min-w-0 flex-1">{option}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * O campo nasce dentro da frase, no lugar do `___` que o professor escreveu —
 * ver a lacuna no contexto é metade do exercício. Se o enunciado não tiver o
 * marcador, o campo cai logo abaixo e a questão continua respondível.
 */
function FillBlankPrompt({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: string;
  onChange: (value: string) => void;
}) {
  const parts = question.prompt.split(BLANK_TOKEN);
  const field = (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={200}
      size={Math.max(8, value.length + 2)}
      aria-label={`Preencha a lacuna: ${question.prompt}`}
      className="mx-1 inline-block min-w-24 rounded-lg border-0 border-b-2 border-gold-400 bg-gold-50/60 px-2 py-0.5 text-sm font-semibold text-navy-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );

  if (parts.length === 1) {
    return (
      <div>
        <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-navy-900">
          {question.prompt}
        </p>
        <div className="mt-2">{field}</div>
      </div>
    );
  }

  return (
    <p className="text-sm font-medium leading-loose text-navy-900">
      {parts.map((part, index) => (
        <span key={index}>
          {part}
          {/* Só uma lacuna por questão: as demais viram o marcador literal. */}
          {index < parts.length - 1 && (index === 0 ? field : BLANK_TOKEN)}
        </span>
      ))}
    </p>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;

  if (state === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <LogoLoader size={14} label={null} />
        salvando…
      </span>
    );
  }

  if (state === "error") {
    return <span className="text-xs font-medium text-destructive">não salvo</span>;
  }

  return (
    <span className="flex items-center gap-1 text-xs text-success">
      <CheckIcon className="h-3.5 w-3.5" />
      rascunho salvo
    </span>
  );
}
