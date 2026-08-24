"use client";

/**
 * Troca da própria senha. Pede a senha atual (a action revalida no servidor) e
 * mostra o mesmo medidor de força do primeiro acesso — as regras vêm de
 * `passwordRules`, então o que o medidor aprova é o que o servidor aceita.
 */

import { useActionState, useState } from "react";
import { changeMyPasswordAction } from "@/actions/shared/account";
import {
  accountClasses,
  type AccountTheme,
} from "@/components/features/account/account-theme";
import { Button } from "@/components/ui/button";
import { FieldError, FormBanner } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordStrength } from "@/components/ui/password-strength";
import { cn } from "@/lib/utils";

export function PasswordForm({ theme = "app" }: { theme?: AccountTheme }) {
  const classes = accountClasses(theme);
  const [state, formAction, isPending] = useActionState(changeMyPasswordAction, null);
  const [password, setPassword] = useState("");
  const fields = state && !state.success ? state.error.fields : undefined;

  return (
    <form action={formAction} className={classes.card} noValidate>
      <h2 className={classes.heading}>Alterar senha</h2>
      <p className={cn("mt-1", classes.muted)}>
        Mínimo de 8 caracteres, com maiúscula, minúscula e número.
      </p>

      <div className="mt-5 max-w-md space-y-4">
        {state && !state.success && !state.error.fields && (
          <FormBanner tone="error">{state.error.message}</FormBanner>
        )}
        {state?.success && <FormBanner tone="success">Senha alterada.</FormBanner>}

        <div className="space-y-1.5">
          <Label htmlFor="currentPassword">Senha atual</Label>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
          <FieldError messages={fields?.["currentPassword"]} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Nova senha</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <PasswordStrength value={password} />
          <FieldError messages={fields?.["password"]} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
          />
          <FieldError messages={fields?.["confirmPassword"]} />
        </div>

        <Button type="submit" disabled={isPending} className={classes.primaryButton}>
          {isPending ? "Alterando…" : "Alterar senha"}
        </Button>
      </div>
    </form>
  );
}
