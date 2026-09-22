"use client";

import { useActionState, useEffect, useState } from "react";
import { gradeSubmissionAction } from "@/actions/teacher/assignments";
import { gradeSubmissionAsAdminAction } from "@/actions/admin/assignments";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FieldError, FormBanner } from "@/components/ui/form-message";
import { LogoLoader } from "@/components/ui/logo-loader";
import {
  manualGradeFieldName,
  manualNoteFieldName,
  type ManualGrades,
  type ManualNotes,
  type Question,
} from "@/lib/assignments/exercises";

export function GradeSubmissionForm({
  assignmentId,
  studentId,
  maxScore,
  initialScore,
  initialFeedback,
  /** Nota sugerida pela correção automática, quando a tarefa é 100% objetiva. */
  suggestedScore,
  /** O professor se autoriza por ser dono da turma; o admin, pela organização
   * — daí duas ações em vez de um `if` de papel dentro de uma só. */
  variant = "teacher",
  /** Questões dissertativas (ou sem gabarito) — o professor pontua uma a uma aqui. */
  openQuestions = [],
  initialManualGrades = {},
  initialManualNotes = {},
  autoScore = 0,
  autoMax = 0,
}: {
  assignmentId: string;
  studentId: string;
  maxScore: number | null;
  initialScore?: number | null;
  initialFeedback?: string | null;
  suggestedScore?: number | null;
  variant?: "teacher" | "admin";
  openQuestions?: Question[];
  initialManualGrades?: ManualGrades;
  /** Comentário/resposta certa que o professor já escreveu por questão — o aluno lê isto. */
  initialManualNotes?: ManualNotes;
  autoScore?: number;
  autoMax?: number;
}) {
  const action = (
    variant === "admin" ? gradeSubmissionAsAdminAction : gradeSubmissionAction
  ).bind(null, assignmentId, studentId);
  const [state, formAction, isPending] = useActionState(action, null);

  const [manualGrades, setManualGrades] = useState<ManualGrades>(initialManualGrades);
  const [scoreTouched, setScoreTouched] = useState(false);
  const [scoreValue, setScoreValue] = useState<number | "">(
    initialScore ?? suggestedScore ?? "",
  );

  const openMax = openQuestions.reduce((sum, q) => sum + q.points, 0);
  const gradedOpenCount = openQuestions.filter(
    (q) => manualGrades[q.id] !== undefined,
  ).length;
  const manualScore = openQuestions.reduce((sum, q) => {
    const given = manualGrades[q.id];
    return given === undefined ? sum : sum + Math.min(Math.max(given, 0), q.points);
  }, 0);
  const totalMax = autoMax + openMax;
  const liveSuggestion =
    gradedOpenCount === openQuestions.length && totalMax > 0 && maxScore != null
      ? Math.round(((autoScore + manualScore) / totalMax) * maxScore * 10) / 10
      : null;

  // Enquanto o professor não mexeu na nota final na mão, ela segue a soma das
  // questões — mesmo comportamento de antes (sugestão só das objetivas), só
  // que agora também reage às dissertativas conforme são corrigidas.
  useEffect(() => {
    if (scoreTouched || initialScore != null) return;
    if (liveSuggestion != null) setScoreValue(liveSuggestion);
  }, [liveSuggestion, scoreTouched, initialScore]);

  function handleManualGradeChange(questionId: string, raw: string, points: number) {
    setManualGrades((prev) => {
      const next = { ...prev };
      if (raw === "") {
        delete next[questionId];
      } else {
        const num = Number(raw);
        next[questionId] = Number.isFinite(num) ? Math.min(Math.max(num, 0), points) : 0;
      }
      return next;
    });
  }

  return (
    <form action={formAction} className="space-y-3" noValidate>
      {state && !state.success && !state.error.fields && (
        <FormBanner tone="error">{state.error.message}</FormBanner>
      )}
      {state?.success && <FormBanner tone="success">Nota salva.</FormBanner>}

      {openQuestions.length > 0 && (
        <div className="space-y-2 rounded-xl bg-muted/40 p-3">
          <p className="text-xs font-medium text-navy-700">
            Corrija as questões dissertativas
          </p>
          {openQuestions.map((question, index) => {
            const fieldId = `${manualGradeFieldName(question.id)}-${studentId}`;
            const noteFieldId = `${manualNoteFieldName(question.id)}-${studentId}`;
            return (
              <div key={question.id} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Label htmlFor={fieldId} className="flex-1 text-xs font-normal">
                    Questão {index + 1}
                  </Label>
                  <Input
                    id={fieldId}
                    name={manualGradeFieldName(question.id)}
                    type="number"
                    min={0}
                    max={question.points}
                    step="0.5"
                    value={manualGrades[question.id] ?? ""}
                    onChange={(e) =>
                      handleManualGradeChange(question.id, e.target.value, question.points)
                    }
                    placeholder="0"
                    className="w-20"
                  />
                  <span className="text-xs text-muted-foreground">
                    / {question.points} pt
                  </span>
                </div>
                <textarea
                  id={noteFieldId}
                  name={manualNoteFieldName(question.id)}
                  rows={2}
                  defaultValue={initialManualNotes[question.id] ?? ""}
                  placeholder="Resposta certa e/ou explicação para o aluno (opcional)"
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`score-${studentId}`}>
            Nota {maxScore ? `(0–${maxScore})` : ""}
          </Label>
          <Input
            id={`score-${studentId}`}
            name="score"
            type="number"
            min={0}
            max={maxScore ?? 1000}
            step="0.1"
            value={scoreValue}
            onChange={(e) => {
              setScoreTouched(true);
              setScoreValue(e.target.value === "" ? "" : Number(e.target.value));
            }}
            required
            className="w-28"
          />
        </div>
        <Button type="submit" disabled={isPending} className="h-10">
          {isPending ? (
            <span className="inline-flex items-center gap-2">
              <LogoLoader size={16} label={null} />
              Salvando…
            </span>
          ) : (
            "Salvar nota"
          )}
        </Button>
        {initialScore == null && scoreValue !== "" && !scoreTouched && (
          <p className="text-xs text-muted-foreground">
            Sugestão da correção automática — ajuste se quiser.
          </p>
        )}
      </div>
      <FieldError
        messages={state && !state.success ? state.error.fields?.["score"] : undefined}
      />

      <div className="space-y-1.5">
        <Label htmlFor={`feedback-${studentId}`}>Feedback (opcional)</Label>
        <textarea
          id={`feedback-${studentId}`}
          name="feedback"
          rows={2}
          defaultValue={initialFeedback ?? undefined}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
    </form>
  );
}
