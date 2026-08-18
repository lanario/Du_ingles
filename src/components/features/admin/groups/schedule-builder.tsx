"use client";

import { useState } from "react";
import type { ScheduleEntry } from "@/schemas/groups";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function ScheduleBuilder() {
  const [entries, setEntries] = useState<ScheduleEntry[]>([
    { weekday: 1, start: "19:00", end: "20:30" },
  ]);

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
            className="h-10 rounded-md border border-admin-border bg-admin-background px-2 text-sm"
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
            className="h-10 rounded-md border border-admin-border bg-admin-background px-2 text-sm"
          />
          <span className="text-admin-foreground/60">até</span>
          <input
            type="time"
            value={entry.end}
            onChange={(e) => update(i, { end: e.target.value })}
            className="h-10 rounded-md border border-admin-border bg-admin-background px-2 text-sm"
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
        className="text-sm text-admin-accent hover:underline"
      >
        + Adicionar horário
      </button>
    </div>
  );
}
