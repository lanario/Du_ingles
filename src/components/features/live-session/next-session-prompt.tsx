"use client";

/**
 * A pergunta do fim da aula: "marca a próxima?".
 *
 * A agenda não é mais gerada de mês em mês (ver `0035_next_session_only.sql`):
 * a aula seguinte existe porque alguém decidiu marcá-la. O momento certo de
 * perguntar é este — o professor acabou de dar a aula, sabe onde a turma
 * parou e sabe se a próxima semana vale o mesmo horário.
 *
 * Por isso o cartão mora na sala de aula ENCERRADA, e não num aviso solto:
 * quem encerrou vê a pergunta na hora (o formulário abre sozinho), e quem
 * voltar depois ainda encontra o convite ali, com os campos preenchidos com o
 * que a grade da turma sugere.
 */

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { ptBR } from "date-fns/locale";
import { scheduleNextSessionAction } from "@/actions/admin/lesson-planner";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateField } from "@/components/ui/date-field";
import { TimeField } from "@/components/ui/time-field";
import { FieldError, FormBanner } from "@/components/ui/form-message";
import { LogoLoader } from "@/components/ui/logo-loader";
import { CalendarIcon, CheckIcon } from "@/components/ui/icons";
import { SCHOOL_TZ } from "@/lib/schedule/session-preview";
import { cn } from "@/lib/utils";
import type { NextSessionPlan } from "@/repositories/class-sessions";

const DURATIONS = [30, 45, 60, 90, 120];

/** Encerrou agora? Então a pergunta chega aberta, sem exigir mais um clique. */
const JUST_ENDED_MS = 30 * 60 * 1000;

function formatFull(iso: string): string {
  return formatInTimeZone(new Date(iso), SCHOOL_TZ, "EEEE',' dd/MM 'às' HH:mm", {
    locale: ptBR,
  });
}

export function NextSessionPrompt({
  sessionId,
  plan,
  endedAt,
  tone = "app",
}: {
  sessionId: string;
  plan: NextSessionPlan;
  /** Fim da aula — decide se o formulário abre sozinho. */
  endedAt: string | null;
  tone?: "app" | "admin";
}) {
  const router = useRouter();
  const action = useMemo(
    () => scheduleNextSessionAction.bind(null, sessionId),
    [sessionId],
  );
  const [state, formAction, isPending] = useActionState(action, null);

  const justEnded = !!endedAt && Date.now() - new Date(endedAt).getTime() < JUST_ENDED_MS;
  const [open, setOpen] = useState(!plan.alreadyScheduled && justEnded);
  const [dismissed, setDismissed] = useState(false);

  const suggestion = plan.suggestion;
  const initial = useMemo(
    () => ({
      date: formatInTimeZone(new Date(suggestion.scheduledAt), SCHOOL_TZ, "yyyy-MM-dd"),
      time: formatInTimeZone(new Date(suggestion.scheduledAt), SCHOOL_TZ, "HH:mm"),
    }),
    [suggestion.scheduledAt],
  );

  const [duration, setDuration] = useState(suggestion.durationMinutes);
  const fields = state && !state.success ? state.error.fields : undefined;

  useEffect(() => {
    if (state?.success) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  const admin = tone === "admin";
  const card = admin
    ? "border-admin-border bg-admin-surface text-admin-foreground"
    : "border-border bg-background text-foreground";
  const primary = admin ? "bg-navy-900 text-white" : "bg-primary text-primary-foreground";

  if (plan.alreadyScheduled) {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm",
          card,
        )}
      >
        <CheckIcon className="h-4 w-4 shrink-0 text-[var(--success)]" />
        <p className="min-w-0 flex-1">
          Próxima aula de <strong className="font-medium">{plan.groupName}</strong>:{" "}
          {formatFull(plan.alreadyScheduled.scheduledAt)}.
        </p>
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "flex flex-wrap items-center gap-3 rounded-xl border border-dashed px-4 py-3.5",
          card,
        )}
      >
        <CalendarIcon className="h-4 w-4 shrink-0 opacity-50" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {dismissed
              ? "A próxima aula desta turma ainda não está marcada."
              : `Marcar a próxima aula de ${plan.groupName}?`}
          </p>
          <p className="mt-0.5 text-xs opacity-60">
            Sugestão pela grade da turma: {formatFull(suggestion.scheduledAt)} ·{" "}
            {suggestion.durationMinutes} min. Dá para mudar tudo antes de salvar.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!dismissed && (
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="h-9 rounded-lg px-3 text-sm font-medium opacity-60 transition-opacity hover:opacity-100"
            >
              Agora não
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              "inline-flex h-9 items-center rounded-lg px-3.5 text-sm font-semibold transition-opacity hover:opacity-90",
              primary,
            )}
          >
            Marcar próxima aula
          </button>
        </div>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Próxima aula"
        description={`${plan.groupName} — confirme os dados da aula seguinte.`}
      >
        <form action={formAction} className="space-y-5" noValidate>
          {state && !state.success && (
            <FormBanner tone="error">{state.error.message}</FormBanner>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="next-title">
              Título da aula <span className="text-primary">*</span>
            </Label>
            <Input
              id="next-title"
              name="title"
              defaultValue={suggestion.title}
              placeholder="Ex.: Present Perfect — parte 2"
              required
            />
            <FieldError messages={fields?.["title"]} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="next-date">
                Data <span className="text-primary">*</span>
              </Label>
              <DateField
                id="next-date"
                name="date"
                defaultValue={initial.date}
                required
              />
              <FieldError messages={fields?.["date"]} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="next-time">
                Horário <span className="text-primary">*</span>
              </Label>
              <TimeField
                id="next-time"
                name="time"
                defaultValue={initial.time}
                required
              />
              <FieldError messages={fields?.["time"]} />
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Duração</legend>
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
                    duration === minutes
                      ? "border-navy-900 bg-navy-900 text-white"
                      : "border-border text-foreground/70 hover:bg-muted",
                  )}
                >
                  {minutes} min
                </button>
              ))}
            </div>
            <FieldError messages={fields?.["durationMinutes"]} />
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="next-notes">O que vem na próxima (só você vê)</Label>
            <textarea
              id="next-notes"
              name="notes"
              rows={3}
              placeholder="Onde a turma parou, o que retomar, quem faltou…"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <FieldError messages={fields?.["notes"]} />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-10 rounded-xl border border-border px-4 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted"
            >
              Agora não
            </button>
            <button
              type="submit"
              disabled={isPending}
              className={cn(
                "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60",
                primary,
              )}
            >
              {isPending ? (
                <>
                  <LogoLoader size={16} label={null} />
                  Marcando…
                </>
              ) : (
                "Marcar aula"
              )}
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
