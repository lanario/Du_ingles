"use client";

/**
 * Marcar ou editar o que não é aula: reunião, evento, prova, recesso,
 * lembrete.
 *
 * Aula não passa por aqui. Ela nasce da grade da turma e carrega plano,
 * chamada e registro — mexer nela é trabalho do planejador, e a agenda só
 * remarca (`moveSessionAction`). Misturar as duas coisas neste formulário
 * daria a impressão de que dá para criar uma aula solta, sem turma.
 *
 * O corte de permissão do formulário é o mesmo da action: o professor tem
 * que escolher uma das turmas dele, a coordenação pode marcar para a escola
 * inteira. Esconder a opção não autoriza nada — quem barra é
 * `authorizeScope` no servidor —, mas oferecer um campo que vai ser recusado
 * é pior do que não oferecer.
 */

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createAgendaEventAction,
  updateAgendaEventAction,
} from "@/actions/admin/agenda";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { DateField } from "@/components/ui/date-field";
import { TimeField } from "@/components/ui/time-field";
import { FieldError, FormBanner } from "@/components/ui/form-message";
import { LogoLoader } from "@/components/ui/logo-loader";
import { cn } from "@/lib/utils";
import type { AgendaGroupRef, AgendaItem } from "@/repositories/agenda";
import { AGENDA_AUDIENCES, AGENDA_EVENT_KINDS } from "@/types/domain";
import { AUDIENCE_LABEL, EVENT_KIND_LABEL, minutesLabel } from "./agenda-utils";

const DURATIONS = [30, 45, 60, 90, 120, 180];

export interface AgendaEventDraft {
  /** Compromisso existente — ausente quando é criação. */
  item?: AgendaItem;
  day: string;
  time: string;
  groupId: string | null;
}

export function AgendaEventDialog({
  draft,
  groups,
  canCreateSchoolWide,
  tone,
  onClose,
}: {
  /** `null` fecha — a agenda guarda qual compromisso está em edição. */
  draft: AgendaEventDraft | null;
  groups: AgendaGroupRef[];
  canCreateSchoolWide: boolean;
  tone: "app" | "admin";
  onClose: () => void;
}) {
  if (!draft) return null;
  return (
    <EventForm
      key={draft.item?.id ?? `${draft.day}-${draft.time}-${draft.groupId ?? "escola"}`}
      draft={draft}
      groups={groups}
      canCreateSchoolWide={canCreateSchoolWide}
      tone={tone}
      onClose={onClose}
    />
  );
}

/**
 * Componente separado e remontado por `key`: os campos são não controlados,
 * e `defaultValue` só entra no primeiro render — reaproveitar o formulário
 * entre dois compromissos deixaria os valores do anterior na tela.
 */
function EventForm({
  draft,
  groups,
  canCreateSchoolWide,
  tone,
  onClose,
}: {
  draft: AgendaEventDraft;
  groups: AgendaGroupRef[];
  canCreateSchoolWide: boolean;
  tone: "app" | "admin";
  onClose: () => void;
}) {
  const router = useRouter();
  const editing = draft.item;

  const action = useMemo(
    () =>
      editing?.id
        ? updateAgendaEventAction.bind(null, editing.id)
        : createAgendaEventAction,
    [editing?.id],
  );
  const [state, formAction, isPending] = useActionState(action, null);

  const [allDay, setAllDay] = useState(editing?.allDay ?? false);
  const [duration, setDuration] = useState(
    editing && !editing.allDay ? editing.durationMinutes : 60,
  );

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
      size="lg"
      title={editing ? "Editar compromisso" : "Novo compromisso"}
      description={
        canCreateSchoolWide
          ? "Sem turma, o compromisso vale para a escola inteira."
          : "O compromisso fica visível para a turma escolhida."
      }
    >
      <form action={formAction} className="space-y-5" noValidate>
        {state && !state.success && (
          <FormBanner tone="error">{state.error.message}</FormBanner>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="agenda-title">
            Título <span className="text-primary">*</span>
          </Label>
          <Input
            id="agenda-title"
            name="title"
            defaultValue={editing?.title ?? ""}
            placeholder="Reunião pedagógica"
            aria-invalid={Boolean(fields?.["title"])}
          />
          <FieldError messages={fields?.["title"]} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="agenda-kind">Tipo</Label>
            <Select
              id="agenda-kind"
              name="kind"
              tone={tone}
              defaultValue={editing?.eventKind ?? "meeting"}
            >
              {AGENDA_EVENT_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {EVENT_KIND_LABEL[kind]}
                </option>
              ))}
            </Select>
            <FieldError messages={fields?.["kind"]} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="agenda-audience">Quem vê</Label>
            <Select
              id="agenda-audience"
              name="audience"
              tone={tone}
              defaultValue={editing?.audience ?? "all"}
            >
              {AGENDA_AUDIENCES.map((audience) => (
                <option key={audience} value={audience}>
                  {AUDIENCE_LABEL[audience]}
                </option>
              ))}
            </Select>
            <FieldError messages={fields?.["audience"]} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="agenda-group">
            Turma {!canCreateSchoolWide && <span className="text-primary">*</span>}
          </Label>
          <Select
            id="agenda-group"
            name="groupId"
            tone={tone}
            defaultValue={editing?.groupId ?? draft.groupId ?? ""}
            placeholder={canCreateSchoolWide ? "Escola inteira" : "Escolha a turma"}
          >
            {canCreateSchoolWide && <option value="">Escola inteira</option>}
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} · {group.level}
              </option>
            ))}
          </Select>
          <FieldError messages={fields?.["groupId"]} />
        </div>

        <label className="flex items-center gap-2.5 text-sm font-medium">
          <input
            type="checkbox"
            name="allDay"
            value="true"
            checked={allDay}
            onChange={(event) => setAllDay(event.target.checked)}
            className="h-4 w-4 rounded border-border accent-[var(--primary)]"
          />
          Dia inteiro
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="agenda-date">
              Data <span className="text-primary">*</span>
            </Label>
            <DateField
              id="agenda-date"
              name="date"
              tone={tone}
              defaultValue={draft.day}
              required
            />
            <FieldError messages={fields?.["date"]} />
          </div>

          {/* Dia inteiro não tem hora útil: o schema normaliza para 00:00 e
              1440 minutos, então o campo desaparece em vez de mentir. */}
          <div className={cn("space-y-1.5", allDay && "hidden")}>
            <Label htmlFor="agenda-time">
              Horário <span className="text-primary">*</span>
            </Label>
            <TimeField
              id="agenda-time"
              name="time"
              tone={tone}
              defaultValue={draft.time}
              required={!allDay}
            />
            <FieldError messages={fields?.["time"]} />
          </div>
        </div>

        <fieldset className={cn("space-y-2", allDay && "hidden")}>
          <legend className="text-sm font-medium">Duração</legend>
          <input type="hidden" name="durationMinutes" value={allDay ? 1440 : duration} />
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
                {minutes >= 60 ? minutesLabel(minutes).replace(":", "h") : `${minutes} min`}
              </button>
            ))}
          </div>
          <FieldError messages={fields?.["durationMinutes"]} />
        </fieldset>

        <div className="space-y-1.5">
          <Label htmlFor="agenda-location">Local</Label>
          <Input
            id="agenda-location"
            name="location"
            defaultValue={editing?.location ?? ""}
            placeholder="Sala 2, online, auditório…"
          />
          <FieldError messages={fields?.["location"]} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="agenda-description">Descrição</Label>
          <textarea
            id="agenda-description"
            name="description"
            rows={3}
            defaultValue={editing?.description ?? ""}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Pauta, material necessário, observações…"
          />
          <FieldError messages={fields?.["description"]} />
        </div>

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
            ) : editing ? (
              "Salvar"
            ) : (
              "Marcar"
            )}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
