"use client";

import { useActionState } from "react";
import { gradeSubmissionAction } from "@/actions/teacher/assignments";
import { gradeSubmissionAsAdminAction } from "@/actions/admin/assignments";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FieldError, FormBanner } from "@/components/ui/form-message";
import { LogoLoader } from "@/components/ui/logo-loader";

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
}: {
  assignmentId: string;
  studentId: string;
  maxScore: number | null;
  initialScore?: number | null;
  initialFeedback?: string | null;
  suggestedScore?: number | null;
  variant?: "teacher" | "admin";
}) {
  const action = (
    variant === "admin" ? gradeSubmissionAsAdminAction : gradeSubmissionAction
  ).bind(null, assignmentId, studentId);
  const [state, formAction, isPending] = useActionState(action, null);

  const defaultScore = initialScore ?? suggestedScore ?? undefined;

  return (
    <form action={formAction} className="space-y-3" noValidate>
      {state && !state.success && !state.error.fields && (
        <FormBanner tone="error">{state.error.message}</FormBanner>
      )}
      {state?.success && <FormBanner tone="success">Nota salva.</FormBanner>}

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
            defaultValue={defaultScore}
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
        {initialScore == null && suggestedScore != null && (
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
