"use client";

import { useState, useTransition } from "react";
import { startSessionAction } from "@/actions/teacher/live-session";
import { FormBanner } from "@/components/ui/form-message";
import type { LessonPlanListItem } from "@/repositories/lesson-plans";

export function StartSessionForm({
  sessionId,
  lessonPlans,
}: {
  sessionId: string;
  lessonPlans: LessonPlanListItem[];
}) {
  const [planId, setPlanId] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="max-w-md space-y-4">
      {error && <FormBanner tone="error">{error}</FormBanner>}
      <div className="space-y-1.5">
        <label htmlFor="planId" className="text-sm font-medium">
          Plano de aula (opcional)
        </label>
        <select
          id="planId"
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">Começar em branco</option>
          {lessonPlans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          O conteúdo do plano é copiado para esta sessão — editar aqui não altera o plano
          original.
        </p>
      </div>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await startSessionAction(sessionId, planId || null);
            if (!result.success) setError(result.error.message);
          });
        }}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Iniciando…" : "Iniciar aula"}
      </button>
    </div>
  );
}
