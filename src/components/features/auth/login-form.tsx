"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "@/actions/auth/login";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormBanner } from "@/components/ui/form-message";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, null);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state && !state.success && !state.error.fields && (
        <FormBanner tone="error">{state.error.message}</FormBanner>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={
            state && !state.success ? Boolean(state.error.fields?.["email"]) : undefined
          }
          aria-describedby="email-error"
        />
        <div id="email-error">
          <FieldError
            messages={state && !state.success ? state.error.fields?.["email"] : undefined}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Senha</Label>
          <Link
            href="/recuperar-senha"
            className="text-sm text-muted-foreground hover:underline"
          >
            Esqueceu a senha?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={
            state && !state.success
              ? Boolean(state.error.fields?.["password"])
              : undefined
          }
          aria-describedby="password-error"
        />
        <div id="password-error">
          <FieldError
            messages={
              state && !state.success ? state.error.fields?.["password"] : undefined
            }
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
