"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "@/actions/auth/login";
import { AuthField } from "@/components/features/auth/auth-field";
import { LockIcon, MailIcon } from "@/components/ui/icons";
import { FormBanner } from "@/components/ui/form-message";

export interface LoginFormProps {
  /**
   * Quando informado, "Esqueceu a senha?" troca o conteúdo da face no lugar
   * (uso dentro do `AuthSwitch`) em vez de navegar para `/recuperar-senha`.
   */
  onForgotPassword?: () => void;
}

export function LoginForm({ onForgotPassword }: LoginFormProps = {}) {
  const [state, formAction, isPending] = useActionState(loginAction, null);

  const fields = state && !state.success ? state.error.fields : undefined;
  const forgotClass = "text-sm text-muted-foreground hover:text-primary hover:underline";

  return (
    <form action={formAction} className="space-y-3 text-left" noValidate>
      {state && !state.success && !state.error.fields && (
        <FormBanner tone="error">{state.error.message}</FormBanner>
      )}

      <AuthField
        id="email"
        name="email"
        label="E-mail"
        type="email"
        autoComplete="email"
        placeholder="E-mail"
        required
        icon={<MailIcon className="size-5" />}
        errors={fields?.["email"]}
      />

      <AuthField
        id="password"
        name="password"
        label="Senha"
        type="password"
        autoComplete="current-password"
        placeholder="Senha"
        required
        icon={<LockIcon className="size-5" />}
        errors={fields?.["password"]}
      />

      <button
        type="submit"
        disabled={isPending}
        className="btn-cta-fill h-12 w-full text-sm uppercase tracking-wide disabled:pointer-events-none disabled:opacity-60"
      >
        {isPending ? "Entrando…" : "Entrar"}
      </button>

      <div className="text-center">
        {onForgotPassword ? (
          <button type="button" onClick={onForgotPassword} className={forgotClass}>
            Esqueceu a senha?
          </button>
        ) : (
          <Link href="/recuperar-senha" className={forgotClass}>
            Esqueceu a senha?
          </Link>
        )}
      </div>
    </form>
  );
}
