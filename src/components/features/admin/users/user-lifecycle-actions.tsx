"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  deactivateUserAction,
  reactivateUserAction,
  softDeleteUserAction,
} from "@/actions/admin/users";
import { FormBanner } from "@/components/ui/form-message";
import type { UserDetail } from "@/repositories/users";
import type { ActiveTeacherGroup } from "@/lib/teacher-group-conflict";

interface UserActionError {
  message: string;
  details?: { activeGroups: ActiveTeacherGroup[] };
}

type UserActionResult =
  { success: true; data: never } | { success: false; error: UserActionError };

export function UserLifecycleActions({ user }: { user: UserDetail }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<UserActionError | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function run(action: () => Promise<UserActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) setError(result.error);
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <UserActionErrorBanner
          message={error.message}
          activeGroups={error.details?.activeGroups}
        />
      )}

      <div className="flex flex-wrap gap-2">
        {user.isActive ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => deactivateUserAction(user.id))}
            className="rounded-md border border-admin-border px-3 py-1.5 text-sm hover:bg-admin-muted disabled:opacity-50"
          >
            Desativar
          </button>
        ) : (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => reactivateUserAction(user.id))}
            className="rounded-md border border-admin-border px-3 py-1.5 text-sm hover:bg-admin-muted disabled:opacity-50"
          >
            Reativar
          </button>
        )}

        {!confirmingDelete ? (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="rounded-md border border-destructive/40 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
          >
            Excluir
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 px-3 py-1.5">
            <span className="text-sm text-destructive">Confirma a exclusão?</span>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => softDeleteUserAction(user.id))}
              className="text-sm font-medium text-destructive underline"
            >
              Sim, excluir
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="text-sm text-admin-foreground/60"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function UserActionErrorBanner({
  message,
  activeGroups,
}: {
  message: string;
  activeGroups?: ActiveTeacherGroup[];
}) {
  return (
    <FormBanner tone="error">
      <p>{message}</p>
      {activeGroups && activeGroups.length > 0 && (
        <ul className="mt-2 list-inside list-disc space-y-1">
          {activeGroups.map((group) => (
            <li key={group.id}>
              <Link
                href={`/admin/turmas/${group.id}` as Route}
                className="font-medium underline underline-offset-2"
              >
                {group.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </FormBanner>
  );
}
