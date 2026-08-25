"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordResetAction } from "@/actions/auth/request-password-reset";
import { AuthField } from "@/components/features/auth/auth-field";
import { MailIcon } from "@/components/ui/icons";
import { FormBanner } from "@/components/ui/form-message";
import { LogoLoader } from "@/components/ui/logo-loader";

export interface RequestResetFormProps {
  /**
   * Quando informado, "Voltar para o login" troca o conteúdo da face no lugar
   * (uso dentro do `AuthSwitch`) em vez de navegar para `/login`.
   */
  onBack?: () => void;
}

export function RequestResetForm({ onBack }: RequestResetFormProps = {}) {
  const [state, formAction, isPending] = useActionState(requestPasswordResetAction, null);

  const backClass =
    "block w-full text-center text-sm text-muted-foreground hover:text-primary hover:underline";
  const back = onBack ? (
    <button type="button" onClick={onBack} className={backClass}>
      Voltar para o login
    </button>
  ) : (
    <Link href="/login" className={backClass}>
      Voltar para o login
    </Link>
  );

  if (state?.success) {
    return (
      <div className="space-y-4 text-left">
        <FormBanner tone="success">
          Se esse e-mail estiver cadastrado, você receberá um link para redefinir a senha
          em instantes.
        </FormBanner>
        {back}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3 text-left" noValidate>
      {state && !state.success && !state.error.fields && (
        <FormBanner tone="error">{state.error.message}</FormBanner>
      )}

      <AuthField
        id="reset-email"
        name="email"
        label="E-mail"
        type="email"
        autoComplete="email"
        placeholder="E-mail"
        required
        icon={<MailIcon className="size-5" />}
        errors={state && !state.success ? state.error.fields?.["email"] : undefined}
      />

      <button
        type="submit"
        disabled={isPending}
        className="btn-cta-fill h-12 w-full text-sm uppercase tracking-wide disabled:pointer-events-none disabled:opacity-60"
      >
        {isPending ? (
          <span className="inline-flex items-center gap-2">
            <LogoLoader size={16} label={null} />
            Enviando…
          </span>
        ) : (
          "Enviar link"
        )}
      </button>

      {back}
    </form>
  );
}
