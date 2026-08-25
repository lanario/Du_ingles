"use client";

import { useActionState } from "react";
import { updateLessonPlanMetaAction } from "@/actions/teacher/lesson-plans";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { FormBanner } from "@/components/ui/form-message";
import { CEFR_LEVELS } from "@/types/domain";
import type { LessonPlanDetail } from "@/repositories/lesson-plans";
import { LogoLoader } from "@/components/ui/logo-loader";

export function LessonPlanMetaForm({ plan }: { plan: LessonPlanDetail }) {
  const action = updateLessonPlanMetaAction.bind(null, plan.id);
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state && !state.success && (
        <FormBanner tone="error">{state.error.message}</FormBanner>
      )}
      {state?.success && <FormBanner tone="success">Dados salvos.</FormBanner>}

      <div className="space-y-1.5">
        <Label htmlFor="title">Título</Label>
        <Input
          id="title"
          name="title"
          defaultValue={plan.title}
          required
          disabled={!plan.isOwn}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="summary">Resumo</Label>
        <Input
          id="summary"
          name="summary"
          defaultValue={plan.summary ?? ""}
          disabled={!plan.isOwn}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="level">Nível</Label>
          <Select id="level" name="level" defaultValue={plan.level} disabled={!plan.isOwn}>
            {CEFR_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="durationMinutes">Duração (min)</Label>
          <Input
            id="durationMinutes"
            name="durationMinutes"
            type="number"
            min={15}
            step={15}
            defaultValue={plan.durationMinutes}
            disabled={!plan.isOwn}
          />
        </div>
      </div>

      {plan.isOwn && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isShared" defaultChecked={plan.isShared} />
          Compartilhar com outros professores da escola
        </label>
      )}

      {plan.isOwn && (
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? (
            <span className="inline-flex items-center gap-2">
              <LogoLoader size={16} label={null} />
              Salvando…
            </span>
          ) : (
            "Salvar dados"
          )}
        </button>
      )}
    </form>
  );
}
