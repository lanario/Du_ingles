"use client";

/**
 * Chamada da aula. Fica ao lado da folha, não numa tela separada: quem está
 * dando aula marca presença enquanto fala, e o salvamento é explícito para
 * não gravar meia chamada a cada clique.
 */

import { useMemo, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { recordPlannerAttendanceAction } from "@/actions/admin/lesson-planner";
import { cn } from "@/lib/utils";
import type { AttendanceRow } from "@/repositories/attendance";
import type { AttendanceStatus } from "@/types/domain";

const OPTIONS: { value: AttendanceStatus; label: string; short: string; tone: string }[] =
  [
    { value: "present", label: "Presente", short: "P", tone: "bg-[var(--success)]" },
    { value: "late", label: "Atrasado", short: "A", tone: "bg-[var(--warning)]" },
    { value: "absent", label: "Faltou", short: "F", tone: "bg-red-600" },
    { value: "excused", label: "Justificado", short: "J", tone: "bg-navy-600" },
  ];

export function RosterPanel({
  sessionId,
  initialRows,
  readOnly = false,
}: {
  sessionId: string;
  initialRows: AttendanceRow[];
  readOnly?: boolean;
}) {
  const [rows, setRows] = useState(initialRows);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const marked = useMemo(() => rows.filter((row) => row.status !== null).length, [rows]);

  function setStatus(studentId: string, status: AttendanceStatus) {
    setRows((previous) =>
      previous.map((row) => (row.studentId === studentId ? { ...row, status } : row)),
    );
    setSavedAt(null);
  }

  function markAllPresent() {
    setRows((previous) =>
      previous.map((row) => (row.status ? row : { ...row, status: "present" })),
    );
    setSavedAt(null);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set(
        "entries",
        JSON.stringify(
          rows
            .filter((row) => row.status !== null)
            .map((row) => ({ studentId: row.studentId, status: row.status })),
        ),
      );
      const result = await recordPlannerAttendanceAction(sessionId, formData);
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      setSavedAt(new Date());
    });
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-admin-border px-4 py-6 text-center text-xs text-admin-foreground/50">
        Nenhum aluno matriculado nesta turma.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-admin-foreground/55">
          <span className="font-semibold tabular text-admin-foreground">{marked}</span> de{" "}
          <span className="tabular">{rows.length}</span> marcados
        </p>
        {!readOnly && (
          <button
            type="button"
            onClick={markAllPresent}
            className="text-xs font-medium text-navy-700 underline underline-offset-2"
          >
            todos presentes
          </button>
        )}
      </div>

      <ul className="space-y-1.5">
        {rows.map((row) => (
          <li
            key={row.studentId}
            className="flex items-center justify-between gap-2 rounded-xl border border-admin-border/70 px-3 py-2"
          >
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-admin-foreground">
              {row.studentName}
            </span>
            <div className="flex shrink-0 gap-1">
              {OPTIONS.map((option) => {
                const active = row.status === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    title={option.label}
                    aria-label={`${row.studentName}: ${option.label}`}
                    aria-pressed={active}
                    disabled={readOnly}
                    onClick={() => setStatus(row.studentId, option.value)}
                    className={cn(
                      "relative grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold transition-colors",
                      active
                        ? cn("text-white", option.tone)
                        : "border border-admin-border text-admin-foreground/45 hover:bg-admin-muted",
                      readOnly && "pointer-events-none",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId={`roster-${row.studentId}`}
                        className={cn("absolute inset-0 rounded-full", option.tone)}
                        transition={{ type: "spring", stiffness: 480, damping: 34 }}
                      />
                    )}
                    <span className="relative">{option.short}</span>
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}

      {!readOnly && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={isPending}
            className="inline-flex h-9 items-center rounded-lg bg-navy-900 px-3.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Salvando…" : "Salvar chamada"}
          </button>
          {savedAt && (
            <span className="text-[11px] text-admin-foreground/50">
              salva às {savedAt.toLocaleTimeString("pt-BR")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
