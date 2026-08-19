"use client";

import { useActionState } from "react";
import { updateUserAction } from "@/actions/admin/users";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/ui/date-field";
import { Label } from "@/components/ui/label";
import { FieldError, FormBanner } from "@/components/ui/form-message";
import type { UserDetail } from "@/repositories/users";

export function EditUserForm({ user }: { user: UserDetail }) {
  const action = updateUserAction.bind(null, user.id);
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <form action={formAction} className="max-w-lg space-y-4" noValidate>
      {state && !state.success && !state.error.fields && (
        <FormBanner tone="error">{state.error.message}</FormBanner>
      )}
      {state?.success && <FormBanner tone="success">Dados atualizados.</FormBanner>}

      <div className="space-y-1.5">
        <Label htmlFor="fullName">Nome completo</Label>
        <Input id="fullName" name="fullName" defaultValue={user.fullName} required />
        <FieldError
          messages={
            state && !state.success ? state.error.fields?.["fullName"] : undefined
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="phone">Telefone</Label>
          <Input id="phone" name="phone" type="tel" defaultValue={user.phone ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="birthDate">Data de nascimento</Label>
          <DateField id="birthDate" name="birthDate" defaultValue={user.birthDate ?? ""} />
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-admin-accent px-4 py-2 text-sm font-medium text-admin-accent-foreground hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Salvando…" : "Salvar alterações"}
      </button>
    </form>
  );
}
