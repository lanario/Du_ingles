"use client";

import { useActionState } from "react";
import { createLessonPlanAction } from "@/actions/teacher/lesson-plans";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormBanner } from "@/components/ui/form-message";
import { CEFR_LEVELS } from "@/types/domain";

export function CreateLessonPlanForm() {
  const [state, formAction, isPending] = useActionState(createLessonPlanAction, null);

  return (
    <form action={formAction} className="max-w-lg space-y-4" noValidate>
      {state && !state.success && !state.error.fields && (
        <FormBanner tone="error">{state.error.message}</FormBanner>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="title">Título</Label>
        <Input id="title" name="title" required />
        <FieldError
          messages={state && !state.success ? state.error.fields?.["title"] : undefined}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="summary">Resumo (opcional)</Label>
        <Input id="summary" name="summary" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="level">Nível</Label>
          <select
            id="level"
            name="level"
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            {CEFR_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="durationMinutes">Duração (min)</Label>
          <Input
            id="durationMinutes"
            name="durationMinutes"
            type="number"
            min={15}
            step={15}
            defaultValue={60}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Criando…" : "Criar plano"}
      </button>
    </form>
  );
}
