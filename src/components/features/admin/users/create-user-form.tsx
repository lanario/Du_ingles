"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createUserAction } from "@/actions/admin/users";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormBanner } from "@/components/ui/form-message";
import type { AppRole } from "@/types/domain";

export function CreateUserForm() {
  const [state, formAction, isPending] = useActionState(createUserAction, null);
  const [role, setRole] = useState<AppRole>("student");

  if (state?.success) {
    return (
      <div className="max-w-md rounded-lg border border-admin-border bg-admin-muted p-6">
        <h2 className="font-semibold text-admin-accent">Usuário criado</h2>
        <p className="mt-2 text-sm text-admin-foreground/80">
          Compartilhe esta senha temporária com o usuário por um canal seguro (ela não
          será mostrada novamente). No primeiro login, a troca de senha é obrigatória.
        </p>
        <code className="mt-4 block rounded-md bg-admin-background px-3 py-2 font-mono text-sm">
          {state.data.tempPassword}
        </code>
        <div className="mt-5 flex gap-3 text-sm">
          <Link href="/admin/usuarios" className="text-admin-accent hover:underline">
            Ver lista de usuários
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="max-w-lg space-y-4" noValidate>
      {state && !state.success && !state.error.fields && (
        <FormBanner tone="error">{state.error.message}</FormBanner>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="fullName">Nome completo</Label>
        <Input id="fullName" name="fullName" required />
        <FieldError
          messages={
            state && !state.success ? state.error.fields?.["fullName"] : undefined
          }
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" required />
        <FieldError
          messages={state && !state.success ? state.error.fields?.["email"] : undefined}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="phone">Telefone</Label>
          <Input id="phone" name="phone" type="tel" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="birthDate">Data de nascimento</Label>
          <Input id="birthDate" name="birthDate" type="date" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="role">Papel</Label>
        <select
          id="role"
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value as AppRole)}
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="student">Aluno</option>
          <option value="teacher">Professor</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {role === "teacher" && (
        <div className="space-y-4 rounded-md border border-admin-border p-4">
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio (opcional)</Label>
            <textarea
              id="bio"
              name="bio"
              rows={2}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isPublic" />
            Exibir na landing page
          </label>
        </div>
      )}

      {role === "student" && (
        <div className="space-y-4 rounded-md border border-admin-border p-4">
          <p className="text-xs text-admin-foreground/60">
            Obrigatório se o aluno for menor de idade.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="guardianName">Nome do responsável</Label>
            <Input id="guardianName" name="guardianName" />
            <FieldError
              messages={
                state && !state.success ? state.error.fields?.["guardianName"] : undefined
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="guardianEmail">E-mail do responsável</Label>
              <Input id="guardianEmail" name="guardianEmail" type="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guardianPhone">Telefone do responsável</Label>
              <Input id="guardianPhone" name="guardianPhone" type="tel" />
            </div>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-admin-accent px-4 py-2 text-sm font-medium text-admin-accent-foreground hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Criando…" : "Criar usuário"}
      </button>
    </form>
  );
}
