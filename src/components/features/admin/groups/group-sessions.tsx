"use client";

/**
 * Sessões da turma, em linha do tempo. A próxima aula fica em destaque no
 * topo — é a informação que o admin abre a página para conferir; o histórico
 * passado colapsa atrás de um botão para não empurrar o resto para fora da
 * tela.
 *
 * A lista tem dois tipos de linha, e a diferença importa:
 *
 * - **aula marcada**: existe no banco, tem id, dá para dar, remarcar,
 *   cancelar ou excluir;
 * - **prévia**: não existe em lugar nenhum — é a grade semanal projetada
 *   adiante (`src/lib/schedule/session-preview.ts`). Serve para o aluno ver
 *   como o mês tende a ficar sem que ninguém tenha prometido aquelas datas.
 *
 * Desde `0035_next_session_only.sql` o banco guarda só a próxima aula de cada
 * turma: é o professor que confirma a seguinte ao encerrar a anterior. Por
 * isso a prévia existe, e por isso ela é pontilhada — quem olha precisa saber
 * o que está marcado e o que é só previsão.
 */

import { useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  cancelSessionAction,
  deleteSessionAction,
  scheduleSessionAction,
} from "@/actions/admin/lesson-planner";
import { ActionMenu } from "@/components/ui/action-menu";
import { CalendarIcon, ChevronIcon, PencilIcon, TrashIcon } from "@/components/ui/icons";
import { LogoLoader } from "@/components/ui/logo-loader";
import { cn } from "@/lib/utils";
import type { SessionListItem, SessionPreviewItem } from "@/repositories/class-sessions";
import type { ActionResult } from "@/types/action-result";
import type { SessionStatus } from "@/types/domain";
import { EditSessionDialog } from "../planner/session-edit-dialog";

const STATUS_LABEL: Record<SessionStatus, string> = {
  scheduled: "Agendada",
  in_progress: "Em andamento",
  completed: "Concluída",
  cancelled: "Cancelada",
};

const STATUS_TONE: Record<SessionStatus, string> = {
  scheduled: "var(--navy-500)",
  in_progress: "var(--success)",
  completed: "var(--gold-700)",
  cancelled: "var(--muted-foreground)",
};

/** Quantas sessões futuras aparecem antes do "ver mais". */
const UPCOMING_VISIBLE = 6;

export function GroupSessions({
  sessions,
  previews = [],
  groupId,
  groupName,
  canManage = false,
}: {
  sessions: SessionListItem[];
  previews?: SessionPreviewItem[];
  groupId: string;
  groupName: string;
  /** Coordenação e professor da turma mexem na agenda; o resto só lê. */
  canManage?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [editing, setEditing] = useState<SessionListItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const { past, upcoming } = useMemo(() => {
    const now = Date.now();
    const sorted = [...sessions].sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );
    return {
      past: sorted.filter((item) => new Date(item.scheduledAt).getTime() < now).reverse(),
      upcoming: sorted.filter((item) => new Date(item.scheduledAt).getTime() >= now),
    };
  }, [sessions]);

  function run(id: string, action: () => Promise<ActionResult<never>>) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const result = await action();
      setBusyId(null);
      if (!result.success) setError(result.error.message);
    });
  }

  function cancel(session: SessionListItem) {
    if (
      !window.confirm(
        `Cancelar a aula de ${new Date(session.scheduledAt).toLocaleString("pt-BR")}? Ela fica na lista como cancelada e o horário não é remarcado sozinho.`,
      )
    )
      return;
    run(session.id, () => cancelSessionAction(session.id));
  }

  function remove(session: SessionListItem) {
    if (
      !window.confirm(
        `Excluir de vez a aula de ${new Date(session.scheduledAt).toLocaleString("pt-BR")}? O horário volta a ficar livre na grade da turma.`,
      )
    )
      return;
    run(session.id, () => deleteSessionAction(session.id));
  }

  /** Prévia vira aula de verdade: mesma turma, mesmo horário, agora marcada. */
  function confirmPreview(preview: SessionPreviewItem) {
    const at = new Date(preview.scheduledAt);
    const form = new FormData();
    form.set("groupId", groupId);
    form.set("title", groupName);
    form.set("date", at.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }));
    form.set(
      "time",
      at.toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
    form.set("durationMinutes", String(preview.durationMinutes));
    run(preview.key, () => scheduleSessionAction(null, form));
  }

  if (sessions.length === 0 && previews.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-admin-border px-4 py-10 text-center text-sm text-admin-foreground/50">
        Nenhuma sessão gerada ainda — confira se a turma tem horários definidos na grade
        semanal.
      </p>
    );
  }

  const shown = expanded ? upcoming : upcoming.slice(0, UPCOMING_VISIBLE);
  const hiddenCount = upcoming.length - shown.length;
  const shownPreviews = expanded ? previews : previews.slice(0, UPCOMING_VISIBLE);

  return (
    <div className="space-y-3">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {error}
        </p>
      )}

      {upcoming.length === 0 && previews.length === 0 ? (
        <p className="rounded-xl border border-dashed border-admin-border px-4 py-6 text-center text-sm text-admin-foreground/50">
          Nenhuma sessão futura — o período da turma pode ter terminado.
        </p>
      ) : (
        <ol className="relative space-y-2 border-l border-admin-border pl-4">
          <AnimatePresence initial={false}>
            {shown.map((session, index) => (
              <SessionRow
                key={session.id}
                session={session}
                index={index}
                next={index === 0}
                reduceMotion={Boolean(reduceMotion)}
                busy={busyId === session.id}
                canManage={canManage}
                onEdit={() => setEditing(session)}
                onCancel={() => cancel(session)}
                onDelete={() => remove(session)}
              />
            ))}

            {shownPreviews.map((preview, index) => (
              <PreviewRow
                key={preview.key}
                preview={preview}
                index={shown.length + index}
                reduceMotion={Boolean(reduceMotion)}
                busy={busyId === preview.key}
                canManage={canManage}
                onConfirm={() => confirmPreview(preview)}
              />
            ))}
          </AnimatePresence>
        </ol>
      )}

      {previews.length > 0 && (
        <p className="pl-4 text-xs text-admin-foreground/45">
          As datas pontilhadas são previsão da grade semanal — a aula entra na agenda
          quando o professor confirma, normalmente ao encerrar a aula anterior.
        </p>
      )}

      {(hiddenCount > 0 || previews.length > shownPreviews.length || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gold-700 transition-colors hover:text-gold-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
        >
          <ChevronIcon
            className={cn("h-3.5 w-3.5 transition-transform", expanded && "-rotate-90")}
          />
          {expanded ? "Mostrar menos" : "Ver o mês inteiro"}
        </button>
      )}

      {past.length > 0 && (
        <div className="border-t border-admin-border pt-3">
          <button
            type="button"
            onClick={() => setShowPast((value) => !value)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-admin-foreground/55 transition-colors hover:text-admin-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
          >
            <ChevronIcon
              className={cn("h-3.5 w-3.5 transition-transform", showPast && "-rotate-90")}
            />
            Histórico ({past.length} {past.length === 1 ? "sessão" : "sessões"})
          </button>

          <AnimatePresence initial={false}>
            {showPast && (
              <motion.ol
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="mt-3 space-y-2 overflow-hidden border-l border-admin-border pl-4"
              >
                {past.map((session, index) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    index={index}
                    reduceMotion={Boolean(reduceMotion)}
                    busy={busyId === session.id}
                    canManage={canManage}
                    onEdit={() => setEditing(session)}
                    onCancel={() => cancel(session)}
                    onDelete={() => remove(session)}
                    dimmed
                  />
                ))}
              </motion.ol>
            )}
          </AnimatePresence>
        </div>
      )}

      <EditSessionDialog session={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function SessionRow({
  session,
  index,
  next = false,
  dimmed = false,
  reduceMotion,
  busy,
  canManage,
  onEdit,
  onCancel,
  onDelete,
}: {
  session: SessionListItem;
  index: number;
  next?: boolean;
  dimmed?: boolean;
  reduceMotion: boolean;
  busy: boolean;
  canManage: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const status = session.status as SessionStatus;
  const tone = STATUS_TONE[status] ?? "var(--muted-foreground)";
  const date = new Date(session.scheduledAt);

  // Aula dada (ou em andamento) não se remarca nem se apaga: tem chamada,
  // registro e PDF pendurados nela.
  const editable = status === "scheduled";
  const removable = status === "scheduled" || status === "cancelled";

  return (
    <motion.li
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{
        duration: 0.28,
        delay: Math.min(index, 8) * 0.035,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={cn(
        "relative rounded-xl border px-3.5 py-2.5",
        next ? "border-gold-300 bg-gold-50/60" : "border-admin-border bg-admin-surface",
        (dimmed || status === "cancelled") && "opacity-70",
      )}
    >
      <span
        aria-hidden
        className="absolute -left-[21px] top-4 h-2.5 w-2.5 rounded-full ring-4 ring-[var(--admin-background)]"
        style={{ backgroundColor: tone }}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm text-admin-foreground">
            <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-admin-foreground/40" />
            <span className={cn("tabular", status === "cancelled" && "line-through")}>
              {date.toLocaleString("pt-BR", {
                weekday: "short",
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {next && (
              <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-700">
                Próxima
              </span>
            )}
          </p>
          <p className="mt-0.5 truncate text-xs text-admin-foreground/50">
            {session.title} · {session.durationMinutes} min
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <span
            style={{
              color: tone,
              backgroundColor: `color-mix(in srgb, ${tone} 10%, #ffffff)`,
            }}
            className="rounded-full px-2.5 py-1 text-[11px] font-medium"
          >
            {STATUS_LABEL[status] ?? status}
          </span>

          {busy && <LogoLoader size={16} label={null} />}

          {canManage && !busy && (editable || removable) && (
            <ActionMenu
              label={`Ações da aula de ${date.toLocaleDateString("pt-BR")}`}
              items={[
                ...(editable
                  ? [
                      {
                        label: "Editar aula",
                        icon: PencilIcon,
                        onSelect: onEdit,
                      },
                      {
                        label: "Cancelar aula",
                        icon: CalendarIcon,
                        onSelect: onCancel,
                        tone: "danger" as const,
                        separated: true,
                      },
                    ]
                  : []),
                ...(removable
                  ? [
                      {
                        label: "Excluir da agenda",
                        icon: TrashIcon,
                        onSelect: onDelete,
                        tone: "danger" as const,
                        separated: !editable,
                      },
                    ]
                  : []),
              ]}
            />
          )}
        </div>
      </div>
    </motion.li>
  );
}

function PreviewRow({
  preview,
  index,
  reduceMotion,
  busy,
  canManage,
  onConfirm,
}: {
  preview: SessionPreviewItem;
  index: number;
  reduceMotion: boolean;
  busy: boolean;
  canManage: boolean;
  onConfirm: () => void;
}) {
  const date = new Date(preview.scheduledAt);

  return (
    <motion.li
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{
        duration: 0.28,
        delay: Math.min(index, 8) * 0.035,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="relative rounded-xl border border-dashed border-admin-border/80 bg-transparent px-3.5 py-2.5"
    >
      <span
        aria-hidden
        className="absolute -left-[21px] top-4 h-2.5 w-2.5 rounded-full border border-admin-border bg-[var(--admin-background)] ring-4 ring-[var(--admin-background)]"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm text-admin-foreground/70">
            <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-admin-foreground/30" />
            <span className="tabular">
              {date.toLocaleString("pt-BR", {
                weekday: "short",
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </p>
          <p className="mt-0.5 truncate text-xs text-admin-foreground/40">
            Previsão da grade · {preview.durationMinutes} min
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full border border-dashed border-admin-border px-2.5 py-1 text-[11px] font-medium text-admin-foreground/50">
            Prévia
          </span>
          {canManage &&
            (busy ? (
              <LogoLoader size={16} label={null} />
            ) : (
              <button
                type="button"
                onClick={onConfirm}
                className="h-7 rounded-lg border border-admin-border px-2.5 text-xs font-medium text-admin-foreground/70 transition-colors hover:bg-admin-muted hover:text-admin-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
              >
                Marcar
              </button>
            ))}
        </div>
      </div>
    </motion.li>
  );
}
