"use client";

/**
 * Criar ou editar a ficha do plano — título, nível, duração e resumo. O
 * conteúdo em si não passa por aqui: ele mora no canvas, com salvamento
 * automático. Este painel só cuida do que a lista precisa mostrar.
 */

import { useActionState, useEffect, useState } from "react";
import {
  createPlannerPlanAction,
  updatePlannerPlanMetaAction,
} from "@/actions/admin/lesson-planner";
import { SidePanel } from "@/components/ui/side-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormBanner } from "@/components/ui/form-message";
import { CEFR_LEVELS } from "@/types/domain";
import { cn } from "@/lib/utils";
import { LEVEL_HINT } from "./planner-utils";
import type { PlannerPlan } from "@/repositories/lesson-planner";
import { LogoLoader } from "@/components/ui/logo-loader";

const DURATIONS = [30, 45, 60, 90, 120];

export function PlanFormPanel({
  open,
  onClose,
  plan,
}: {
  open: boolean;
  onClose: () => void;
  /** Presente = edição da ficha; ausente = criação. */
  plan?: PlannerPlan;
}) {
  const action = plan
    ? updatePlannerPlanMetaAction.bind(null, plan.id)
    : createPlannerPlanAction;
  const [state, formAction, isPending] = useActionState(action, null);

  const [level, setLevel] = useState<string>(plan?.level ?? CEFR_LEVELS[1] ?? "A2");
  const [duration, setDuration] = useState<number>(plan?.durationMinutes ?? 60);

  const fields = state && !state.success ? state.error.fields : undefined;

  // Criar redireciona para o canvas (a navegação fecha o painel sozinha);
  // editar volta `ok`, e aí quem fecha somos nós.
  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={plan ? "Propriedades da aula" : "Nova aula"}
      subtitle={
        plan
          ? "Ajuste a ficha — o conteúdo continua no canvas."
          : "Dê um nome à aula; o canvas abre em seguida para você montar o conteúdo."
      }
    >
      <form action={formAction} className="flex min-h-full flex-col" noValidate>
        <div className="flex-1 space-y-5 px-4 py-5 sm:px-6">
          {state && !state.success && !state.error.fields && (
            <FormBanner tone="error">{state.error.message}</FormBanner>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="plan-title" className="text-admin-foreground">
              Título <span className="text-gold-600">*</span>
            </Label>
            <Input
              id="plan-title"
              name="title"
              placeholder="Ex.: Present Perfect — experiências de viagem"
              defaultValue={plan?.title}
              autoComplete="off"
              required
              className="border-admin-border bg-admin-background focus-visible:ring-gold-500"
            />
            <FieldError messages={fields?.["title"]} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="plan-summary" className="text-admin-foreground">
              Resumo
            </Label>
            <textarea
              id="plan-summary"
              name="summary"
              rows={3}
              maxLength={500}
              defaultValue={plan?.summary ?? ""}
              placeholder="Em uma frase: o que o aluno sai sabendo depois desta aula."
              className="w-full rounded-md border border-admin-border bg-admin-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
            />
            <FieldError messages={fields?.["summary"]} />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-admin-foreground">
              Nível (CEFR)
            </legend>
            <input type="hidden" name="level" value={level} />
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {CEFR_LEVELS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setLevel(item)}
                  aria-pressed={level === item}
                  title={LEVEL_HINT[item]}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2.5 text-center transition-colors",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
                    level === item
                      ? "border-gold-400 bg-gold-50 text-admin-foreground"
                      : "border-admin-border bg-admin-surface text-admin-foreground/60 hover:border-gold-300 hover:bg-admin-muted/50",
                  )}
                >
                  <span className="text-sm font-semibold">{item}</span>
                  <span className="text-[10px] leading-tight opacity-70">
                    {LEVEL_HINT[item]}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-admin-foreground">
              Duração prevista
            </legend>
            <input type="hidden" name="durationMinutes" value={duration} />
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => setDuration(minutes)}
                  aria-pressed={duration === minutes}
                  className={cn(
                    "h-9 rounded-full border px-3.5 text-sm font-medium transition-colors",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
                    duration === minutes
                      ? "border-navy-900 bg-navy-900 text-white"
                      : "border-admin-border text-admin-foreground/70 hover:bg-admin-muted",
                  )}
                >
                  {minutes} min
                </button>
              ))}
            </div>
            <FieldError messages={fields?.["durationMinutes"]} />
          </fieldset>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-admin-border bg-admin-background p-3.5">
            <input
              type="checkbox"
              name="isShared"
              defaultChecked={plan?.isShared}
              className="mt-0.5 h-4 w-4 accent-[var(--gold-500)]"
            />
            <span className="text-xs leading-relaxed text-admin-foreground/70">
              <strong className="block text-sm font-medium text-admin-foreground">
                Compartilhar com os professores
              </strong>
              Aulas compartilhadas aparecem na biblioteca de quem dá aula, prontas para
              reaproveitar.
            </span>
          </label>
        </div>

        <div className="sticky bottom-0 flex shrink-0 items-center justify-end gap-3 border-t border-admin-border bg-admin-surface px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-admin-border px-4 text-sm font-medium text-admin-foreground/70 transition-colors hover:bg-admin-muted hover:text-admin-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className={cn(
              "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold-600 to-gold-400 px-5 text-sm font-semibold text-admin-foreground",
              "shadow-[0_8px_24px_-12px_rgba(201,162,39,0.75)] transition-opacity hover:opacity-95",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 disabled:pointer-events-none disabled:opacity-60",
            )}
          >
            {isPending ? (
              <>
                <LogoLoader size={16} label={null} />
                Salvando…
              </>
            ) : plan ? (
              "Salvar ficha"
            ) : (
              "Criar e abrir canvas"
            )}
          </button>
        </div>
      </form>
    </SidePanel>
  );
}
