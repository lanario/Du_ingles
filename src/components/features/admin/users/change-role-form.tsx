"use client";

import { useActionState } from "react";
import { changeUserRoleAction } from "@/actions/admin/users";
import { Select } from "@/components/ui/select";
import { FormBanner } from "@/components/ui/form-message";
import type { AppRole } from "@/types/domain";
import { LogoLoader } from "@/components/ui/logo-loader";

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
        <Select id="role" name="role" tone="admin" defaultValue={currentRole} className="w-40">
          <option value="student">Aluno</option>
          <option value="teacher">Professor</option>
          <option value="admin">Admin</option>
        </Select>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="h-10 rounded-md border border-admin-border px-3 text-sm hover:bg-admin-muted disabled:opacity-50"
      >
        {isPending ? (
          <span className="inline-flex items-center gap-2">
            <LogoLoader size={16} label={null} />
            Salvando…
          </span>
        ) : (
          "Alterar papel"
        )}
      </button>
    </form>
  );
}
