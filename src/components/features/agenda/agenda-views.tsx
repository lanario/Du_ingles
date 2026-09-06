"use client";

/**
 * As quatro vistas da agenda. Todas recebem os itens **já filtrados** e já
 * convertidos para o fuso da escola (`PlacedItem`): nenhuma delas decide o
 * que aparece, só como aparece.
 *
 *   • Dia    — uma coluna por turma, como a grade de horários da escola.
 *   • Semana — sete colunas de dia, tudo misturado por horário.
 *   • Mês    — visão de planejamento, com chips e "mais N".
 *   • Lista  — o mesmo conteúdo em linhas; é a vista que serve no celular,
 *              onde uma grade de colunas seria ilegível.
 *
 * A faixa de "dia inteiro" fica fora da grade de horas em dia e semana:
 * feriado e recesso não têm hora, e desenhá-los como um bloco de 24 linhas
 * empurraria todo o resto para fora da tela.
 */

import { Fragment, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { AgendaItem } from "@/repositories/agenda";
import { AgendaCard, AgendaChip, AgendaRow, type ToneMap, toneOf } from "./agenda-card";
import {
  WEEKDAY_SHORT,
  dayNumber,
  dayOfWeek,
  isSameMonth,
  layoutDay,
  longDateLabel,
  minutesLabel,
  nowMinutes,
  weekOf,
  monthMatrix,
  shortDateLabel,
  type PlacedItem,
} from "./agenda-utils";

export const SLOT_MINUTES = 30;
export const SLOT_HEIGHT = 44;
export const PIXELS_PER_MINUTE = SLOT_HEIGHT / SLOT_MINUTES;
const TIME_COLUMN = 60;
/** Altura mínima de um cartão, em minutos de grade. */
const MINIMUM_SPAN = 25;

export interface GridBounds {
  start: number;
  end: number;
}

interface SharedProps {
  placed: PlacedItem[];
  tones: ToneMap;
  today: string;
  onSelect: (item: AgendaItem) => void;
  /** Ausente quando quem olha não pode marcar nada (aluno). */
  onCreateAt?: (info: { day: string; time: string; groupId: string | null }) => void;
}

function slotsOf(bounds: GridBounds): number[] {
  const out: number[] = [];
  for (let minute = bounds.start; minute < bounds.end; minute += SLOT_MINUTES) {
    out.push(minute);
  }
  return out;
}

function TimeColumn({ bounds }: { bounds: GridBounds }) {
  return (
    <div
      className="sticky left-0 z-10 shrink-0 border-r border-[var(--agenda-border)] bg-[var(--agenda-surface)]"
      style={{ width: TIME_COLUMN }}
    >
      {slotsOf(bounds).map((minute) => (
        <div key={minute} className="relative" style={{ height: SLOT_HEIGHT }}>
          {minute % 60 === 0 && (
            <span className="absolute right-2 top-0 -translate-y-1/2 text-[11px] font-medium tabular-nums text-[var(--agenda-muted-fg)]">
              {minutesLabel(minute)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** Linhas de fundo + slots clicáveis de uma coluna de dia. */
function SlotBackground({
  bounds,
  day,
  groupId,
  onCreateAt,
}: {
  bounds: GridBounds;
  day: string;
  groupId: string | null;
  onCreateAt?: SharedProps["onCreateAt"];
}) {
  return (
    <>
      {slotsOf(bounds).map((minute, index) => {
        const label = minutesLabel(minute);
        const shared = {
          className: cn(
            "absolute left-0 right-0 border-b",
            minute % 60 === 0
              ? "border-[var(--agenda-border)]"
              : "border-[color-mix(in_srgb,var(--agenda-border)_55%,transparent)]",
          ),
          style: { top: index * SLOT_HEIGHT, height: SLOT_HEIGHT },
        };

        if (!onCreateAt) return <div key={minute} aria-hidden {...shared} />;

        return (
          <button
            key={minute}
            type="button"
            onClick={() => onCreateAt({ day, time: label, groupId })}
            aria-label={`Marcar compromisso em ${shortDateLabel(day)} às ${label}`}
            {...shared}
            className={cn(
              shared.className,
              "group/slot transition-colors hover:bg-[color-mix(in_srgb,var(--agenda-accent)_10%,transparent)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--agenda-accent)]",
            )}
          >
            <span
              aria-hidden
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--agenda-muted-fg)] opacity-0 transition-opacity group-hover/slot:opacity-100"
            >
              +
            </span>
          </button>
        );
      })}
    </>
  );
}

/** Traço do "agora" — só aparece na coluna do dia de hoje. */
function NowLine({ bounds }: { bounds: GridBounds }) {
  const minutes = nowMinutes();
  if (minutes < bounds.start || minutes > bounds.end) return null;
  return (
    <motion.div
      aria-hidden
      initial={{ scaleX: 0.9, opacity: 0 }}
      animate={{ scaleX: 1, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="pointer-events-none absolute left-0 right-0 z-20 origin-left"
      style={{ top: (minutes - bounds.start) * PIXELS_PER_MINUTE }}
    >
      <span className="block h-px w-full bg-[var(--agenda-now)]" />
      <span className="absolute -left-1 -top-[3px] h-[7px] w-[7px] rounded-full bg-[var(--agenda-now)]" />
    </motion.div>
  );
}

/** Faixa acima da grade: feriado, recesso e tudo o que não tem hora. */
function AllDayStrip({
  days,
  placed,
  tones,
  onSelect,
  columnClassName,
}: {
  days: string[];
  placed: PlacedItem[];
  tones: ToneMap;
  onSelect: (item: AgendaItem) => void;
  columnClassName: string;
}) {
  const byDay = useMemo(() => {
    const map = new Map<string, PlacedItem[]>();
    for (const entry of placed) {
      if (!entry.item.allDay) continue;
      const list = map.get(entry.day) ?? [];
      list.push(entry);
      map.set(entry.day, list);
    }
    return map;
  }, [placed]);

  if (byDay.size === 0) return null;

  return (
    <div className="flex border-b border-[var(--agenda-border)] bg-[var(--agenda-surface)]">
      <div
        className="sticky left-0 z-10 shrink-0 border-r border-[var(--agenda-border)] bg-[var(--agenda-surface)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--agenda-muted-fg)]"
        style={{ width: TIME_COLUMN }}
      >
        Dia todo
      </div>
      {days.map((day) => (
        <div
          key={day}
          className={cn(
            "flex flex-col gap-0.5 border-r border-[var(--agenda-border)] p-1",
            columnClassName,
          )}
        >
          {(byDay.get(day) ?? []).map((entry) => (
            <AgendaChip
              key={entry.item.key}
              placed={entry}
              tone={toneOf(entry.item, tones)}
              onSelect={onSelect}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- dia ------

export interface DayColumn {
  /** `null` é a coluna da escola — o que não pertence a turma nenhuma. */
  id: string | null;
  name: string;
  subtitle?: string;
  tone: string;
}

export function DayView({
  day,
  columns,
  bounds,
  placed,
  tones,
  today,
  onSelect,
  onCreateAt,
}: SharedProps & { day: string; columns: DayColumn[]; bounds: GridBounds }) {
  const ofDay = useMemo(() => placed.filter((entry) => entry.day === day), [placed, day]);
  const height = slotsOf(bounds).length * SLOT_HEIGHT;

  if (columns.length === 0) {
    return <EmptyGrid label="Nenhuma turma selecionada na barra lateral." />;
  }

  return (
    <div className="min-w-max">
      <div className="sticky top-0 z-30 flex border-b border-[var(--agenda-border)] bg-[var(--agenda-surface)]">
        <div
          className="sticky left-0 z-10 shrink-0 border-r border-[var(--agenda-border)] bg-[var(--agenda-surface)]"
          style={{ width: TIME_COLUMN }}
        />
        {columns.map((column) => (
          <div
            key={column.id ?? "school"}
            className="flex min-w-[168px] flex-1 items-center gap-2 border-r border-[var(--agenda-border)] px-3 py-2"
          >
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: column.tone }}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-[var(--agenda-fg)]">
                {column.name}
              </span>
              {column.subtitle && (
                <span className="block truncate text-[11px] text-[var(--agenda-muted-fg)]">
                  {column.subtitle}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      <AllDayStrip
        days={[day]}
        placed={ofDay}
        tones={tones}
        onSelect={onSelect}
        columnClassName="flex-1"
      />

      <div className="flex">
        <TimeColumn bounds={bounds} />
        {columns.map((column) => {
          const items = ofDay.filter(
            (entry) => !entry.item.allDay && entry.item.groupId === column.id,
          );
          const positioned = layoutDay(
            items,
            bounds.start,
            PIXELS_PER_MINUTE,
            MINIMUM_SPAN,
          );
          return (
            <div
              key={column.id ?? "school"}
              className="relative min-w-[168px] flex-1 border-r border-[var(--agenda-border)]"
              style={{
                height,
                backgroundColor: `color-mix(in srgb, ${column.tone} 3%, transparent)`,
              }}
            >
              <SlotBackground
                bounds={bounds}
                day={day}
                groupId={column.id}
                onCreateAt={onCreateAt}
              />
              {day === today && <NowLine bounds={bounds} />}
              {positioned.map((entry, index) => (
                <AgendaCard
                  key={entry.placed.item.key}
                  positioned={entry}
                  tone={toneOf(entry.placed.item, tones)}
                  onSelect={onSelect}
                  index={index}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------- semana ------

export function WeekView({
  anchor,
  bounds,
  placed,
  tones,
  today,
  onSelect,
  onCreateAt,
  onPickDay,
}: SharedProps & {
  anchor: string;
  bounds: GridBounds;
  onPickDay: (day: string) => void;
}) {
  const days = useMemo(() => weekOf(anchor), [anchor]);
  const height = slotsOf(bounds).length * SLOT_HEIGHT;

  return (
    <div className="min-w-max">
      <div className="sticky top-0 z-30 flex border-b border-[var(--agenda-border)] bg-[var(--agenda-surface)]">
        <div
          className="sticky left-0 z-10 shrink-0 border-r border-[var(--agenda-border)] bg-[var(--agenda-surface)]"
          style={{ width: TIME_COLUMN }}
        />
        {days.map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => onPickDay(day)}
            className="flex min-w-[124px] flex-1 flex-col items-center border-r border-[var(--agenda-border)] py-2 transition-colors hover:bg-[var(--agenda-canvas)]"
            aria-label={longDateLabel(day)}
          >
            <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--agenda-muted-fg)]">
              {WEEKDAY_SHORT[dayOfWeek(day)]}
            </span>
            <span
              className={cn(
                "mt-0.5 grid h-7 w-7 place-items-center rounded-full text-sm font-semibold tabular-nums",
                day === today
                  ? "bg-[var(--agenda-primary)] text-[var(--agenda-primary-fg)]"
                  : "text-[var(--agenda-fg)]",
              )}
            >
              {dayNumber(day)}
            </span>
          </button>
        ))}
      </div>

      <AllDayStrip
        days={days}
        placed={placed}
        tones={tones}
        onSelect={onSelect}
        columnClassName="min-w-[124px] flex-1"
      />

      <div className="flex">
        <TimeColumn bounds={bounds} />
        {days.map((day) => {
          const items = placed.filter((entry) => entry.day === day && !entry.item.allDay);
          const positioned = layoutDay(
            items,
            bounds.start,
            PIXELS_PER_MINUTE,
            MINIMUM_SPAN,
          );
          const weekend = dayOfWeek(day) === 0 || dayOfWeek(day) === 6;
          return (
            <div
              key={day}
              className={cn(
                "relative min-w-[124px] flex-1 border-r border-[var(--agenda-border)]",
                weekend && "bg-[var(--agenda-canvas)]",
              )}
              style={{ height }}
            >
              <SlotBackground
                bounds={bounds}
                day={day}
                groupId={null}
                onCreateAt={onCreateAt}
              />
              {day === today && <NowLine bounds={bounds} />}
              {positioned.map((entry, index) => (
                <AgendaCard
                  key={entry.placed.item.key}
                  positioned={entry}
                  tone={toneOf(entry.placed.item, tones)}
                  compact
                  onSelect={onSelect}
                  index={index}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- mês ------

const MONTH_CHIP_LIMIT = 3;

export function MonthView({
  anchor,
  placed,
  tones,
  today,
  onSelect,
  onPickDay,
}: Omit<SharedProps, "onCreateAt"> & {
  anchor: string;
  onPickDay: (day: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const weeks = useMemo(() => monthMatrix(anchor), [anchor]);

  const byDay = useMemo(() => {
    const map = new Map<string, PlacedItem[]>();
    for (const entry of placed) {
      const list = map.get(entry.day) ?? [];
      list.push(entry);
      map.set(entry.day, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startMinutes - b.startMinutes);
    }
    return map;
  }, [placed]);

  return (
    <div className="flex min-h-full flex-col p-2 sm:p-3">
      <div className="grid grid-cols-7">
        {WEEKDAY_SHORT.map((label) => (
          <div
            key={label}
            className="pb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--agenda-muted-fg)]"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid flex-1 auto-rows-fr grid-cols-7 gap-1">
        {weeks.map((week, weekIndex) => (
          <Fragment key={week[0] ?? weekIndex}>
            {week.map((day) => {
              const inMonth = isSameMonth(day, anchor);
              const items = byDay.get(day) ?? [];
              return (
                <motion.button
                  key={day}
                  type="button"
                  data-reveal
                  onClick={() => onPickDay(day)}
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.3,
                    ease: [0.16, 1, 0.3, 1],
                    delay: reduceMotion ? 0 : weekIndex * 0.035,
                  }}
                  className={cn(
                    "flex min-h-[96px] flex-col rounded-xl border p-1.5 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--agenda-accent)]",
                    inMonth
                      ? "border-[var(--agenda-border)] bg-[var(--agenda-surface)] hover:border-[var(--agenda-accent)]"
                      : "border-transparent bg-[var(--agenda-canvas)]",
                  )}
                  aria-label={longDateLabel(day)}
                >
                  <span
                    className={cn(
                      "mb-1 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums",
                      day === today
                        ? "bg-[var(--agenda-primary)] text-[var(--agenda-primary-fg)]"
                        : inMonth
                          ? "text-[var(--agenda-fg)]"
                          : "text-[var(--agenda-muted-fg)] opacity-60",
                    )}
                  >
                    {dayNumber(day)}
                  </span>
                  <span className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                    {items.slice(0, MONTH_CHIP_LIMIT).map((entry) => (
                      <AgendaChip
                        key={entry.item.key}
                        placed={entry}
                        tone={toneOf(entry.item, tones)}
                        onSelect={onSelect}
                      />
                    ))}
                    {items.length > MONTH_CHIP_LIMIT && (
                      <span className="px-1 text-[10px] font-semibold text-[var(--agenda-muted-fg)]">
                        +{items.length - MONTH_CHIP_LIMIT} mais
                      </span>
                    )}
                  </span>
                </motion.button>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

// -------------------------------------------------------------- lista ------

export function ListView({
  from,
  placed,
  tones,
  today,
  onSelect,
}: Omit<SharedProps, "onCreateAt"> & { from: string }) {
  const days = useMemo(() => {
    const map = new Map<string, PlacedItem[]>();
    for (const entry of placed) {
      if (entry.day < from) continue;
      const list = map.get(entry.day) ?? [];
      list.push(entry);
      map.set(entry.day, list);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, items]) => ({
        day,
        items: items.sort((a, b) => a.startMinutes - b.startMinutes),
      }));
  }, [placed, from]);

  if (days.length === 0) {
    return <EmptyGrid label="Nada marcado daqui para a frente com estes filtros." />;
  }

  return (
    <div className="space-y-5 p-3 sm:p-4">
      {days.map(({ day, items }) => (
        <section key={day}>
          <h3
            className={cn(
              "sticky top-0 z-10 -mx-1 mb-2 bg-[var(--agenda-surface)] px-1 py-1 text-xs font-semibold uppercase tracking-wide",
              day === today
                ? "text-[var(--agenda-accent)]"
                : "text-[var(--agenda-muted-fg)]",
            )}
          >
            {day === today ? "Hoje · " : ""}
            {longDateLabel(day)}
          </h3>
          <div className="space-y-1.5">
            {items.map((entry, index) => (
              <AgendaRow
                key={entry.item.key}
                placed={entry}
                tone={toneOf(entry.item, tones)}
                onSelect={onSelect}
                index={index}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- vazio ----

export function EmptyGrid({ label }: { label: string }) {
  return (
    <div className="grid h-full min-h-[280px] place-items-center p-8 text-center">
      <p className="max-w-xs text-sm text-[var(--agenda-muted-fg)]">{label}</p>
    </div>
  );
}
