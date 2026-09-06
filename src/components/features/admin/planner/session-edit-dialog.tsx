"use client";

/**
 * Editar a aula marcada: tema, dia, hora e duração.
 *
 * Um só diálogo para os dois lugares de onde se mexe na aula — a agenda do
 * planejador e a linha do tempo da ficha da turma. Mudar a aula por uma tela
 * ou pela outra tem que dar exatamente no mesmo lugar, inclusive no aviso que
 * sai para o aluno; por isso ambas chamam `rescheduleSessionAction` daqui em
 * vez de manter cada uma o seu formulário.
 *
 * Por isso também `EditableSession` é uma forma mínima, e não o tipo de
 * nenhuma das duas listas: `SessionListItem` (ficha da turma) e
 * `PlannerSession` (agenda) descrevem a mesma aula com campos diferentes, e o
 * diálogo só precisa da interseção.
 */

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { rescheduleSessionAction } from "@/actions/admin/lesson-planner";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateField } from "@/components/ui/date-field";
import { TimeField } from "@/components/ui/time-field";
import { FieldError, FormBanner } from "@/components/ui/form-message";
import { LogoLoader } from "@/components/ui/logo-loader";
import { SCHOOL_TZ } from "@/lib/schedule/session-preview";
import { cn } from "@/lib/utils";

const DURATIONS = [30, 45, 60, 90, 120];

/** O que o formulário precisa saber da aula — nada além disso. */
export interface EditableSession {
  id: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  groupName: string;
}

export function EditSessionDialog({
  session,
  onClose,
}: {
  /** `null` fecha o diálogo — a lista guarda qual aula está sendo editada. */
  session: EditableSession | null;
  onClose: () => void;
}) {
  return session ? (
    <EditSessionForm key={session.id} session={session} onClose={onClose} />
  ) : null;
}

/**
 * Componente separado (e remontado por `key`) porque os campos são não
 * controlados: `defaultValue` só entra no primeiro render, então trocar de
 * aula com o mesmo formulário montado deixaria os valores da anterior.
 */
function EditSessionForm({
  session,
  onClose,
}: {
  session: EditableSession;
  onClose: () => void;
}) {
  const router = useRouter();
  const action = useMemo(
    () => rescheduleSessionAction.bind(null, session.id),
    [session.id],
  );
  const [state, formAction, isPending] = useActionState(action, null);
  const [duration, setDuration] = useState(session.durationMinutes);

  const initial = useMemo(() => {
    const at = new Date(session.scheduledAt);
    return {
      date: formatInTimeZone(at, SCHOOL_TZ, "yyyy-MM-dd"),
      time: formatInTimeZone(at, SCHOOL_TZ, "HH:mm"),
    };
  }, [session.scheduledAt]);

  const fields = state && !state.success ? state.error.fields : undefined;

  useEffect(() => {
    if (state?.success) {
      onClose();
      router.refresh();
    }
  }, [state, onClose, router]);

  return (
    <Dialog
      open
      onClose={onClose}
      title="Editar aula"
      description={`${session.groupName} — a mudança aparece para o aluno e avisa a turma.`}
    >
      <form action={formAction} className="space-y-5" noValidate>
        {state && !state.success && (
          <FormBanner tone="error">{state.error.message}</FormBanner>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="edit-title">Título da aula</Label>
          <Input id="edit-title" name="title" defaultValue={session.title} />
          <FieldError messages={fields?.["title"]} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-date">
              Data <span className="text-primary">*</span>
            </Label>
            <DateField id="edit-date" name="date" defaultValue={initial.date} required />
            <FieldError messages={fields?.["date"]} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-time">
              Horário <span className="text-primary">*</span>
            </Label>
            <TimeField id="edit-time" name="time" defaultValue={initial.time} required />
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

        <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-border px-4 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-navy-900 px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isPending ? (
              <>
                <LogoLoader size={16} label={null} />
                Salvando…
              </>
            ) : (
              "Salvar"
            )}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
