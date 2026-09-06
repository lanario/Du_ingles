"use client";

/**
 * O detalhe de um item da agenda, num painel lateral — a agenda continua na
 * tela atrás dele, que é o ponto: ver o que é aquele bloco não deveria custar
 * uma navegação.
 *
 * O que o painel oferece vem do servidor, não de uma conta feita aqui: cada
 * item chega com `canEdit`/`canDelete` já resolvidos por
 * `repositories/agenda.ts`, e as actions repetem a mesma checagem. O painel
 * só desenha o que veio — nenhuma tela decide permissão.
 *
 * Aula e compromisso saem por portas diferentes de propósito. A aula é
 * remarcada (`moveSessionAction`) ou desmarcada (`removeSessionAction`),
 * porque ela tem plano, chamada e histórico pendurados; o compromisso é
 * editado e excluído no próprio formulário da agenda.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  deleteAgendaEventAction,
  moveSessionAction,
  removeSessionAction,
} from "@/actions/admin/agenda";
import { SidePanel } from "@/components/ui/side-panel";
import { DateField } from "@/components/ui/date-field";
import { TimeField } from "@/components/ui/time-field";
import { FormBanner } from "@/components/ui/form-message";
import { Label } from "@/components/ui/label";
import { LogoLoader } from "@/components/ui/logo-loader";
import { CalendarIcon, PencilIcon, TrashIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { AgendaItem } from "@/repositories/agenda";
import type { ActionResult } from "@/types/action-result";
import { itemTypeLabel, toneOf, type ToneMap } from "./agenda-card";
import {
  AUDIENCE_LABEL,
  SESSION_STATUS_LABEL,
  SESSION_STATUS_TONE,
  durationLabel,
  longDateLabel,
  tint,
  type PlacedItem,
} from "./agenda-utils";

const DURATIONS = [30, 45, 60, 90, 120];

export function AgendaDetail({
  placed,
  tones,
  tone,
  onClose,
  onEditEvent,
}: {
  /** `null` fecha o painel. */
  placed: PlacedItem | null;
  tones: ToneMap;
  tone: "app" | "admin";
  onClose: () => void;
  onEditEvent: (item: AgendaItem) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(60);

  const item = placed?.item ?? null;
  const accent = item ? toneOf(item, tones) : "var(--navy-600)";

  function close() {
    setError(null);
    setRescheduling(false);
    onClose();
  }

  function openReschedule() {
    if (!placed) return;
    setError(null);
    setDate(placed.day);
    setTime(placed.startLabel);
    setDuration(placed.item.durationMinutes);
    setRescheduling(true);
  }

  function run(work: () => Promise<ActionResult<never>>) {
    setError(null);
    startTransition(async () => {
      const result = await work();
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      close();
      router.refresh();
    });
  }

  return (
    <SidePanel
      open={Boolean(placed)}
      onClose={close}
      title={item?.title ?? ""}
      subtitle={placed ? longDateLabel(placed.day) : undefined}
    >
      {placed && item && (
        <div className="space-y-6 px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ backgroundColor: tint(accent, 16), color: accent }}
            >
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: accent }}
              />
              {itemTypeLabel(item)}
            </span>

            {item.status && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: tint(SESSION_STATUS_TONE[item.status], 14),
                  color: SESSION_STATUS_TONE[item.status],
                }}
              >
                {SESSION_STATUS_LABEL[item.status]}
              </span>
            )}

            {item.audience && item.audience !== "all" && (
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {AUDIENCE_LABEL[item.audience]}
              </span>
            )}
          </div>

          <dl className="space-y-3 text-sm">
            <Row label="Quando">
              {item.allDay
                ? "Dia inteiro"
                : `${placed.startLabel} – ${placed.endLabel} · ${durationLabel(item.durationMinutes)}`}
            </Row>
            <Row label="Turma">{item.groupName ?? "Escola inteira"}</Row>
            {item.teacherName && <Row label="Responsável">{item.teacherName}</Row>}
            {item.location && <Row label="Local">{item.location}</Row>}
          </dl>

          {item.description && (
            <p className="whitespace-pre-wrap rounded-xl bg-muted/60 p-3 text-sm text-foreground/80">
              {item.description}
            </p>
          )}

          {item.kind === "preview" && (
            <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
              Esta aula ainda não foi marcada — é o que a grade da turma prevê para
              esta data. Ela passa a existir quando o professor confirmar a
              próxima aula.
            </p>
          )}

          {error && <FormBanner tone="error">{error}</FormBanner>}

          {/* ------------------------------------------------- ações ----- */}

          {(item.canEdit || item.canDelete) && (
            <div className="space-y-3 border-t border-border pt-4">
              <AnimatePresence initial={false} mode="wait">
                {rescheduling && item.kind === "session" ? (
                  <motion.div
                    key="reschedule"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="space-y-4 overflow-hidden"
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="agenda-move-date">Nova data</Label>
                        <DateField
                          id="agenda-move-date"
                          tone={tone}
                          value={date}
                          onChange={setDate}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="agenda-move-time">Novo horário</Label>
                        <TimeField
                          id="agenda-move-time"
                          tone={tone}
                          value={time}
                          onChange={setTime}
                        />
                      </div>
                    </div>

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

                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setRescheduling(false)}
                        className="h-10 rounded-xl border border-border px-4 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted"
                      >
                        Voltar
                      </button>
                      <button
                        type="button"
                        disabled={pending || !item.id}
                        onClick={() => {
                          const id = item.id;
                          if (!id) return;
                          run(() => moveSessionAction(id, date, time, duration));
                        }}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-navy-900 px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                      >
                        {pending ? (
                          <>
                            <LogoLoader size={16} label={null} />
                            Remarcando…
                          </>
                        ) : (
                          "Remarcar"
                        )}
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="actions"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="flex flex-wrap gap-2"
                  >
                    {item.canEdit && item.kind === "session" && (
                      <PanelAction icon={CalendarIcon} onClick={openReschedule}>
                        Remarcar
                      </PanelAction>
                    )}
                    {item.canEdit && item.kind === "event" && (
                      <PanelAction icon={PencilIcon} onClick={() => onEditEvent(item)}>
                        Editar
                      </PanelAction>
                    )}
                    {item.canDelete && (
                      <PanelAction
                        icon={TrashIcon}
                        tone="danger"
                        disabled={pending}
                        onClick={() => {
                          const id = item.id;
                          if (!id) return;
                          const isSession = item.kind === "session";
                          const question = isSession
                            ? "Desmarcar esta aula? A turma é avisada."
                            : "Excluir este compromisso?";
                          if (!window.confirm(question)) return;
                          run(() =>
                            isSession
                              ? removeSessionAction(id)
                              : deleteAgendaEventAction(id),
                          );
                        }}
                      >
                        {item.kind === "session" ? "Desmarcar" : "Excluir"}
                      </PanelAction>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}
    </SidePanel>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 font-medium text-foreground">{children}</dd>
    </div>
  );
}

function PanelAction({
  icon: Icon,
  children,
  onClick,
  disabled,
  tone = "default",
}: {
  icon: typeof CalendarIcon;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors disabled:opacity-60",
        tone === "danger"
          ? "border-destructive/30 text-destructive hover:bg-destructive/10"
          : "border-border text-foreground/80 hover:bg-muted",
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}
