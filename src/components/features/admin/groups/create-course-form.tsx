"use client";

import { useActionState } from "react";
import { createCourseAction } from "@/actions/admin/courses";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormBanner } from "@/components/ui/form-message";
import { CEFR_LEVELS } from "@/types/domain";

export function CreateCourseForm() {
  const [state, formAction, isPending] = useActionState(createCourseAction, null);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3" noValidate>
      {state && !state.success && !state.error.fields && (
        <div className="basis-full">
          <FormBanner tone="error">{state.error.message}</FormBanner>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="name">Nome do curso</Label>
        <Input id="name" name="name" required className="w-56" />
        <FieldError
          messages={state && !state.success ? state.error.fields?.["name"] : undefined}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="level">Nível</Label>
        <select
          id="level"
          name="level"
          className="h-10 rounded-md border border-admin-border bg-admin-background px-3 text-sm"
        >
          {CEFR_LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="totalHours">Carga horária</Label>
        <Input id="totalHours" name="totalHours" type="number" min={1} className="w-32" />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="h-10 rounded-md bg-admin-accent px-4 text-sm font-medium text-admin-accent-foreground hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Criando…" : "Criar curso"}
      </button>
    </form>
  );
}
