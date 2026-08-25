"use client";

/**
 * Redefinição de senha de um professor ou aluno pelo admin. O painel só
 * monta este bloco para contas não-admin — a regra de verdade está na
 * server action, isto aqui é só o espelho dela na interface.
 */

import { useActionState, useEffect, useState } from "react";
import { setUserPasswordAction } from "@/actions/admin/users";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormBanner } from "@/components/ui/form-message";
import { LogoLoader } from "@/components/ui/logo-loader";

export function SetPasswordForm({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const action = setUserPasswordAction.bind(null, userId);
  const [state, formAction, isPending] = useActionState(action, null);
  const [open, setOpen] = useState(false);

  // Sucesso fecha o formulário e deixa só o aviso — evita que a senha recém
  // definida siga visível num campo aberto na tela.
  const succeeded = state?.success === true;
  useEffect(() => {
    if (succeeded) setOpen(false);
  }, [succeeded]);

  if (!open) {
    return (
      <div className="space-y-2">
        {state?.success && (
          <FormBanner tone="success">
            Senha provisória definida. {userName} precisará escolher uma nova senha no
            próximo acesso.
          </FormBanner>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md border border-admin-border px-3 py-1.5 text-sm hover:bg-admin-muted"
        >
          Redefinir senha
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="max-w-lg space-y-4" noValidate>
      {state && !state.success && !state.error.fields && (
        <FormBanner tone="error">{state.error.message}</FormBanner>
      )}

      <p className="text-sm text-admin-foreground/60">
        A senha definida aqui é provisória: no próximo login, {userName} terá de
        escolher uma senha própria. As sessões abertas serão encerradas.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="password">Nova senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
        <FieldError
          messages={state && !state.success ? state.error.fields?.["password"] : undefined}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirmar senha</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
        <FieldError
          messages={
            state && !state.success ? state.error.fields?.["confirmPassword"] : undefined
          }
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-admin-accent px-4 py-2 text-sm font-medium text-admin-accent-foreground hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? (
            <span className="inline-flex items-center gap-2">
              <LogoLoader size={16} label={null} />
              Salvando…
            </span>
          ) : (
            "Definir senha"
          )}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-admin-border px-3 py-2 text-sm hover:bg-admin-muted"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
