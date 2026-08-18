"use client";

import { useActionState, useTransition } from "react";
import { enrollStudentAction, unenrollStudentAction } from "@/actions/admin/groups";
import { FormBanner } from "@/components/ui/form-message";
import type { EnrollmentListItem } from "@/repositories/enrollments";
import type { UserListItem } from "@/repositories/users";

export function EnrollStudentForm({
  groupId,
  enrollments,
  students,
}: {
  groupId: string;
  enrollments: EnrollmentListItem[];
  students: UserListItem[];
}) {
  const action = enrollStudentAction.bind(null, groupId);
  const [state, formAction, isPending] = useActionState(action, null);
  const [isRemoving, startRemove] = useTransition();

  const enrolledIds = new Set(
    enrollments.filter((e) => e.status === "active").map((e) => e.studentId),
  );
  const available = students.filter((s) => !enrolledIds.has(s.id));

  return (
    <div className="space-y-4">
      <form action={formAction} className="flex items-end gap-3">
        {state && !state.success && (
          <div className="basis-full">
            <FormBanner tone="error">{state.error.message}</FormBanner>
          </div>
        )}
        <div className="space-y-1.5">
          <label htmlFor="studentId" className="text-sm font-medium">
            Matricular aluno
          </label>
          <select
            id="studentId"
            name="studentId"
            className="h-10 min-w-56 rounded-md border border-admin-border bg-admin-background px-3 text-sm"
          >
            <option value="">Selecione…</option>
            {available.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={isPending || available.length === 0}
          className="h-10 rounded-md bg-admin-accent px-4 text-sm font-medium text-admin-accent-foreground hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Matriculando…" : "Matricular"}
        </button>
      </form>

      {enrollments.filter((e) => e.status === "active").length === 0 ? (
        <p className="text-sm text-admin-foreground/60">
          Nenhum aluno matriculado ainda.
        </p>
      ) : (
        <ul className="divide-y divide-admin-border rounded-lg border border-admin-border">
          {enrollments
            .filter((e) => e.status === "active")
            .map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{e.studentName}</p>
                  <p className="text-xs text-admin-foreground/60">{e.studentEmail}</p>
                </div>
                <button
                  type="button"
                  disabled={isRemoving}
                  onClick={() =>
                    startRemove(async () => {
                      await unenrollStudentAction(groupId, e.id);
                    })
                  }
                  className="text-destructive hover:underline"
                >
                  Remover
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
