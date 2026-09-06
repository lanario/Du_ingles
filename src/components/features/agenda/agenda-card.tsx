"use client";

/**
 * As peças que representam um compromisso na agenda.
 *
 * São três formatos do mesmo dado, e a diferença é de espaço, não de
 * conteúdo: o **cartão** ocupa a altura proporcional à duração nas vistas de
 * dia e semana; o **chip** é uma linha só, para o mês e para a faixa de dia
 * inteiro; a **linha** é o formato da vista em lista (e do celular), onde há
 * largura de sobra e nenhuma altura para desperdiçar.
 *
 * A cor diz *o que é*: aula herda a cor da turma (estável, definida pelo
 * repositório), compromisso tem cor por tipo. A prévia da grade é a única
 * que muda de textura em vez de cor — pontilhada e translúcida, porque não
 * existe no banco e ninguém prometeu aquela data.
 */

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { AgendaItem } from "@/repositories/agenda";
import {
  EVENT_TONES,
  GROUP_TONES,
  KIND_SINGULAR,
  SESSION_STATUS_LABEL,
  SESSION_STATUS_TONE,
  filterKindOf,
  tint,
  type PositionedItem,
} from "./agenda-utils";

/** Turma → cor, montado uma vez pela raiz e distribuído às vistas. */
export type ToneMap = Map<string, string>;

export function buildToneMap(groups: { id: string; colorIndex: number }[]): ToneMap {
  return new Map(
    groups.map((group) => [
      group.id,
      GROUP_TONES[group.colorIndex % GROUP_TONES.length] ?? GROUP_TONES[0],
    ]),
  );
}

export function toneOf(item: AgendaItem, tones: ToneMap): string {
  if (item.kind === "event") {
    return EVENT_TONES[item.eventKind ?? "meeting"];
  }
  // Aula de turma que sumiu do filtro lateral ainda precisa de uma cor.
  return (item.groupId ? tones.get(item.groupId) : undefined) ?? "var(--navy-600)";
}

/** Etiqueta curta usada nos títulos acessíveis e no painel de detalhe. */
export function itemTypeLabel(item: AgendaItem): string {
  return KIND_SINGULAR[filterKindOf(item)];
}

function statusDot(item: AgendaItem) {
  if (item.kind !== "session" || !item.status) return null;
  return (
    <span
      aria-hidden
      className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
      style={{ backgroundColor: SESSION_STATUS_TONE[item.status] }}
      title={SESSION_STATUS_LABEL[item.status]}
    />
  );
}

function ariaLabel(item: AgendaItem, time: string): string {
  const where = item.groupName ? ` — ${item.groupName}` : "";
  return `${itemTypeLabel(item)}: ${item.title}${where}, ${time}`;
}

// ------------------------------------------------------------- cartão ------

interface CardProps {
  positioned: PositionedItem;
  tone: string;
  /** Colunas estreitas (semana) escondem a segunda linha do cartão. */
  compact?: boolean;
  onSelect: (item: AgendaItem) => void;
  index: number;
}

export function AgendaCard({ positioned, tone, compact, onSelect, index }: CardProps) {
  const reduceMotion = useReducedMotion();
  const { placed, top, height, leftPercent, widthPercent } = positioned;
  const { item } = placed;

  const preview = item.kind === "preview";
  const cancelled = item.status === "cancelled";
  const time = `${placed.startLabel}–${placed.endLabel}`;

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(item)}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
      animate={{ opacity: cancelled ? 0.55 : 1, scale: 1 }}
      transition={{
        duration: 0.28,
        ease: [0.16, 1, 0.3, 1],
        // A cascata é curta de propósito: com trinta aulas na tela, um atraso
        // proporcional deixaria a última entrando meio segundo depois.
        delay: reduceMotion ? 0 : Math.min(index * 0.018, 0.22),
      }}
      whileHover={reduceMotion ? undefined : { y: -1 }}
      className={cn(
        "group absolute flex flex-col overflow-hidden rounded-lg border border-l-[3px] px-2 py-1 text-left",
        "shadow-[0_1px_2px_rgba(11,26,51,0.06)] transition-shadow hover:shadow-[0_6px_18px_rgba(11,26,51,0.12)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--agenda-accent)]",
        preview && "border-dashed",
      )}
      style={{
        top: top + 1,
        height: Math.max(height - 2, 22),
        left: `calc(${leftPercent}% + 1px)`,
        width: `calc(${widthPercent}% - 2px)`,
        borderColor: preview ? tint(tone, 45) : tint(tone, 30),
        borderLeftColor: tone,
        backgroundColor: preview ? tint(tone, 6) : tint(tone, 12),
      }}
      aria-label={ariaLabel(item, time)}
    >
      <span className="flex w-full items-start gap-1">
        <span
          className={cn(
            "min-w-0 flex-1 truncate font-semibold leading-tight text-[var(--agenda-fg)]",
            compact ? "text-[10px]" : "text-xs",
            cancelled && "line-through",
          )}
        >
          {item.title}
        </span>
        {statusDot(item)}
      </span>

      {height >= 38 && (
        <span className="mt-0.5 truncate text-[10px] font-medium text-[var(--agenda-muted-fg)]">
          {item.allDay ? "Dia inteiro" : time}
          {!compact && item.groupName ? ` · ${item.groupName}` : ""}
        </span>
      )}

      {height >= 62 && !compact && item.teacherName && (
        <span className="truncate text-[10px] text-[var(--agenda-muted-fg)]">
          {item.teacherName}
        </span>
      )}
    </motion.button>
  );
}

// --------------------------------------------------------------- chip ------

export function AgendaChip({
  placed,
  tone,
  onSelect,
}: {
  placed: { item: AgendaItem; startLabel: string };
  tone: string;
  onSelect: (item: AgendaItem) => void;
}) {
  const { item } = placed;
  const preview = item.kind === "preview";

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onSelect(item);
      }}
      className={cn(
        "flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] font-medium",
        "text-[var(--agenda-fg)] transition-colors hover:brightness-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--agenda-accent)]",
        preview && "border border-dashed",
        item.status === "cancelled" && "line-through opacity-60",
      )}
      style={{
        backgroundColor: preview ? tint(tone, 7) : tint(tone, 16),
        borderColor: preview ? tint(tone, 45) : undefined,
      }}
      aria-label={ariaLabel(item, item.allDay ? "dia inteiro" : placed.startLabel)}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: tone }}
      />
      <span className="truncate">
        {!item.allDay && <span className="tabular-nums">{placed.startLabel} </span>}
        {item.title}
      </span>
    </button>
  );
}

// -------------------------------------------------------------- linha ------

export function AgendaRow({
  placed,
  tone,
  onSelect,
  index,
}: {
  placed: { item: AgendaItem; startLabel: string; endLabel: string };
  tone: string;
  onSelect: (item: AgendaItem) => void;
  index: number;
}) {
  const reduceMotion = useReducedMotion();
  const { item } = placed;
  const preview = item.kind === "preview";

  return (
    <motion.button
      type="button"
      data-reveal
      onClick={() => onSelect(item)}
      initial={reduceMotion ? false : { opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.3,
        ease: [0.16, 1, 0.3, 1],
        delay: reduceMotion ? 0 : Math.min(index * 0.02, 0.24),
      }}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border border-l-[3px] px-3 py-2.5 text-left",
        "bg-[var(--agenda-surface)] transition-shadow hover:shadow-[0_6px_18px_rgba(11,26,51,0.1)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--agenda-accent)]",
        preview && "border-dashed",
        item.status === "cancelled" && "opacity-60",
      )}
      style={{ borderColor: tint(tone, 28), borderLeftColor: tone }}
      aria-label={ariaLabel(item, `${placed.startLabel}–${placed.endLabel}`)}
    >
      <span className="w-14 shrink-0 text-xs font-semibold tabular-nums text-[var(--agenda-fg)]">
        {item.allDay ? "Dia" : placed.startLabel}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-sm font-semibold text-[var(--agenda-fg)]",
            item.status === "cancelled" && "line-through",
          )}
        >
          {item.title}
        </span>
        <span className="block truncate text-xs text-[var(--agenda-muted-fg)]">
          {itemTypeLabel(item)}
          {item.groupName ? ` · ${item.groupName}` : ""}
          {item.location ? ` · ${item.location}` : ""}
        </span>
      </span>
      {statusDot(item)}
    </motion.button>
  );
}
