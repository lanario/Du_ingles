"use client";

import { useActionState } from "react";
import { gradeSubmissionAction } from "@/actions/teacher/assignments";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FieldError, FormBanner } from "@/components/ui/form-message";

export function GradeSubmissionForm({
  assignmentId,
  studentId,
  maxScore,
  initialScore,
  initialFeedback,
}: {
  assignmentId: string;
  studentId: string;
  maxScore: number | null;
  initialScore?: number | null;
  initialFeedback?: string | null;
}) {
  const action = gradeSubmissionAction.bind(null, assignmentId, studentId);
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-3" noValidate>
      {state && !state.success && !state.error.fields && (
        <FormBanner tone="error">{state.error.message}</FormBanner>
      )}

      <div className="flex items-end gap-3">
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
            defaultValue={initialScore ?? undefined}
            required
            className="w-28"
          />
        </div>
        <Button type="submit" disabled={isPending} className="h-10">
          {isPending ? "Salvando…" : "Salvar nota"}
        </Button>
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
