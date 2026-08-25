"use client";

import { useState, useTransition } from "react";
import { recordAttendanceAction } from "@/actions/teacher/live-session";
import { FormBanner } from "@/components/ui/form-message";
import type { AttendanceRow } from "@/repositories/attendance";
import type { AttendanceStatus } from "@/types/domain";
import { LogoLoader } from "@/components/ui/logo-loader";

const OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: "present", label: "Presente" },
  { value: "absent", label: "Ausente" },
  { value: "late", label: "Atrasado" },
  { value: "excused", label: "Justificado" },
];

export function AttendancePanel({
  sessionId,
  groupId,
  initialRows,
}: {
  sessionId: string;
  groupId: string;
  initialRows: AttendanceRow[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function setStatus(studentId: string, status: AttendanceStatus) {
    setRows((prev) =>
      prev.map((r) => (r.studentId === studentId ? { ...r, status } : r)),
    );
    setSaved(false);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set(
        "entries",
        JSON.stringify(
          rows
            .filter((r) => r.status !== null)
            .map((r) => ({ studentId: r.studentId, status: r.status })),
        ),
      );
      const result = await recordAttendanceAction(sessionId, groupId, formData);
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      setSaved(true);
    });
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum aluno matriculado nesta turma.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error && <FormBanner tone="error">{error}</FormBanner>}
      <ul className="divide-y divide-border rounded-lg border border-border">
        {rows.map((row) => (
          <li
            key={row.studentId}
            className="flex items-center justify-between gap-3 px-4 py-2.5"
          >
            <span className="text-sm">{row.studentName}</span>
            <div className="flex gap-1">
              {OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatus(row.studentId, opt.value)}
                  className={
                    row.status === opt.value
                      ? "rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
                      : "rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? (
            <span className="inline-flex items-center gap-2">
              <LogoLoader size={16} label={null} />
              Salvando…
            </span>
          ) : (
            "Salvar chamada"
          )}
        </button>
        {saved && <span className="text-sm text-muted-foreground">Chamada salva.</span>}
      </div>
    </div>
  );
}
