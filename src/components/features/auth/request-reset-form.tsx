"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordResetAction } from "@/actions/auth/request-password-reset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormBanner } from "@/components/ui/form-message";

export function RequestResetForm() {
  const [state, formAction, isPending] = useActionState(requestPasswordResetAction, null);

  if (state?.success) {
    return (
      <div className="space-y-4">
        <FormBanner tone="success">
          Se esse e-mail estiver cadastrado, você receberá um link para redefinir a senha
          em instantes.
        </FormBanner>
        <Link
          href="/login"
          className="block text-center text-sm text-muted-foreground hover:underline"
        >
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state && !state.success && !state.error.fields && (
        <FormBanner tone="error">{state.error.message}</FormBanner>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
        <FieldError
          messages={state && !state.success ? state.error.fields?.["email"] : undefined}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Enviando…" : "Enviar link de recuperação"}
      </Button>

      <Link
        href="/login"
        className="block text-center text-sm text-muted-foreground hover:underline"
      >
        Voltar para o login
      </Link>
    </form>
  );
}
