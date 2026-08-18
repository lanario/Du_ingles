"use client";

import { useActionState } from "react";
import { changeUserRoleAction } from "@/actions/admin/users";
import { FormBanner } from "@/components/ui/form-message";
import type { AppRole } from "@/types/domain";

export function ChangeRoleForm({
  userId,
  currentRole,
}: {
  userId: string;
  currentRole: AppRole;
}) {
  const action = changeUserRoleAction.bind(null, userId);
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <form action={formAction} className="flex items-end gap-3">
      {state && !state.success && (
        <div className="basis-full">
          <FormBanner tone="error">{state.error.message}</FormBanner>
        </div>
      )}
      <div className="space-y-1.5">
        <label htmlFor="role" className="text-sm font-medium">
          Papel
        </label>
        <select
          id="role"
          name="role"
          defaultValue={currentRole}
          className="h-10 rounded-md border border-admin-border bg-admin-background px-3 text-sm"
        >
          <option value="student">Aluno</option>
          <option value="teacher">Professor</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="h-10 rounded-md border border-admin-border px-3 text-sm hover:bg-admin-muted disabled:opacity-50"
      >
        {isPending ? "Salvando…" : "Alterar papel"}
      </button>
    </form>
  );
}
