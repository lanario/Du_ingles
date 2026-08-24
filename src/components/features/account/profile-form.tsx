"use client";

/**
 * Dados pessoais da própria conta. E-mail e papel aparecem como leitura: o
 * primeiro exige o fluxo de confirmação do Supabase Auth, o segundo é decisão
 * de admin (§3.1).
 */

import { useActionState } from "react";
import { updateMyProfileAction } from "@/actions/shared/account";
import {
  accountClasses,
  type AccountTheme,
} from "@/components/features/account/account-theme";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { FieldError, FormBanner } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { MyProfile } from "@/repositories/users";

const ROLE_LABEL: Record<MyProfile["role"], string> = {
  admin: "Administrador",
  teacher: "Professor",
  student: "Aluno",
};

export function ProfileForm({
  profile,
  theme = "app",
}: {
  profile: MyProfile;
  theme?: AccountTheme;
}) {
  const classes = accountClasses(theme);
  const [state, formAction, isPending] = useActionState(updateMyProfileAction, null);
  const fields = state && !state.success ? state.error.fields : undefined;

  return (
    <form action={formAction} className={classes.card} noValidate>
      <h2 className={classes.heading}>Dados pessoais</h2>
      <p className={cn("mt-1", classes.muted)}>
        É assim que seu nome aparece para professores e colegas.
      </p>

      <div className="mt-5 space-y-4">
        {state && !state.success && !state.error.fields && (
          <FormBanner tone="error">{state.error.message}</FormBanner>
        )}
        {state?.success && <FormBanner tone="success">Dados atualizados.</FormBanner>}

        <div className="space-y-1.5">
          <Label htmlFor="fullName">Nome completo</Label>
          <Input
            id="fullName"
            name="fullName"
            defaultValue={profile.fullName}
            autoComplete="name"
            required
          />
          <FieldError messages={fields?.["fullName"]} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              defaultValue={profile.phone ?? ""}
            />
            <FieldError messages={fields?.["phone"]} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="birthDate">Data de nascimento</Label>
            <DateField
              id="birthDate"
              name="birthDate"
              defaultValue={profile.birthDate ?? ""}
            />
            <FieldError messages={fields?.["birthDate"]} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" value={profile.email} readOnly disabled />
            <p className={classes.muted}>
              Para trocar o e-mail, fale com a administração.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role">Perfil de acesso</Label>
            <Input id="role" value={ROLE_LABEL[profile.role]} readOnly disabled />
          </div>
        </div>

        <Button type="submit" disabled={isPending} className={classes.primaryButton}>
          {isPending ? "Salvando…" : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}
