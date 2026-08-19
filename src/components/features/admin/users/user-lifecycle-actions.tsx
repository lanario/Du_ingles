"use client";

import { useState, useTransition } from "react";
import {
  deactivateUserAction,
  reactivateUserAction,
  softDeleteUserAction,
} from "@/actions/admin/users";
import { enterViewAsModeAction } from "@/actions/admin/view-as";
import { FormBanner } from "@/components/ui/form-message";
import type { UserDetail } from "@/repositories/users";

export function UserLifecycleActions({ user }: { user: UserDetail }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function run(action: () => Promise<{ success: boolean; error?: { message: string } }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) setError(result.error?.message ?? "Falha ao executar a ação.");
    });
  }

  return (
    <div className="space-y-3">
      {error && <FormBanner tone="error">{error}</FormBanner>}

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

        {(user.role === "teacher" || user.role === "student") && (
          <form action={enterViewAsModeAction}>
            <input type="hidden" name="role" value={user.role} />
            <input type="hidden" name="targetUserId" value={user.id} />
            <button
              type="submit"
              className="rounded-md border border-admin-border px-3 py-1.5 text-sm hover:bg-admin-muted"
            >
              {user.role === "teacher"
                ? "Ver como este professor"
                : "Ver como este aluno"}
            </button>
          </form>
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
