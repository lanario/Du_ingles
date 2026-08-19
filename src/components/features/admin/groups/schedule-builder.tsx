"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ScheduleEntry } from "@/schemas/groups";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/**
 * Mesmo construtor nas duas areas; so o *chrome* muda (tokens admin vs. app),
 * como o resto do design system.
 */
export function ScheduleBuilder({
  tone = "admin",
  initial,
}: {
  tone?: "admin" | "app";
  /** Pré-carrega a grade ao editar uma turma existente. */
  initial?: ScheduleEntry[];
}) {
  const field =
    tone === "admin"
      ? "border-admin-border bg-admin-background"
      : "border-border bg-background";
  const mutedText = tone === "admin" ? "text-admin-foreground/60" : "text-muted-foreground";
  const accentText = tone === "admin" ? "text-admin-accent" : "text-gold-600";
  const [entries, setEntries] = useState<ScheduleEntry[]>(
    initial && initial.length > 0 ? initial : [{ weekday: 1, start: "19:00", end: "20:30" }],
  );

  function update(index: number, patch: Partial<ScheduleEntry>) {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name="schedule" value={JSON.stringify(entries)} />
      {entries.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            value={entry.weekday}
            onChange={(e) => update(i, { weekday: Number(e.target.value) })}
            className={cn("h-10 rounded-md border px-2 text-sm", field)}
          >
            {WEEKDAYS.map((day, idx) => (
              <option key={idx} value={idx}>
                {day}
              </option>
            ))}
          </select>
          <input
            type="time"
            value={entry.start}
            onChange={(e) => update(i, { start: e.target.value })}
            className={cn("h-10 rounded-md border px-2 text-sm", field)}
          />
          <span className={mutedText}>até</span>
          <input
            type="time"
            value={entry.end}
            onChange={(e) => update(i, { end: e.target.value })}
            className={cn("h-10 rounded-md border px-2 text-sm", field)}
          />
          {entries.length > 1 && (
            <button
              type="button"
              onClick={() => setEntries((prev) => prev.filter((_, idx) => idx !== i))}
              className="text-sm text-destructive"
            >
              Remover
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          setEntries((prev) => [...prev, { weekday: 1, start: "19:00", end: "20:30" }])
        }
        className={cn("text-sm hover:underline", accentText)}
      >
        + Adicionar horário
      </button>
    </div>
  );
}
