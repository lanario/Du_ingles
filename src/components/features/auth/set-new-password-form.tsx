"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { setNewPasswordAction } from "@/actions/auth/set-new-password";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormBanner } from "@/components/ui/form-message";
import { LogoLoader } from "@/components/ui/logo-loader";

export interface SetNewPasswordFormProps {
  heading: string;
  /** Link de recuperação: verificado aqui (navegador) para scanners não queimarem o OTP. */
  tokenHash?: string;
  type?: string;
}

export function SetNewPasswordForm({ heading, tokenHash, type }: SetNewPasswordFormProps) {
  const [state, formAction, isPending] = useActionState(setNewPasswordAction, null);
  const router = useRouter();
  const needsVerify = Boolean(tokenHash && type === "recovery");
  const [verified, setVerified] = useState(!needsVerify);

  useEffect(() => {
    if (!needsVerify || !tokenHash) return;
    let cancelled = false;
    createBrowserSupabaseClient()
      .auth.verifyOtp({ type: "recovery", token_hash: tokenHash })
      .then(({ error }) => {
        if (cancelled) return;
        if (error) router.push("/recuperar-senha?error=invalid_link");
        else setVerified(true);
      });
    return () => {
      cancelled = true;
    };
  }, [needsVerify, tokenHash, router]);

  if (!verified) {
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <LogoLoader size={16} label={null} />
        Verificando link…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{heading}</p>

      <form action={formAction} className="space-y-4" noValidate>
        {state && !state.success && !state.error.fields && (
          <FormBanner tone="error">{state.error.message}</FormBanner>
        )}

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
            messages={
              state && !state.success ? state.error.fields?.["password"] : undefined
            }
          />
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
          <FieldError
            messages={
              state && !state.success
                ? state.error.fields?.["confirmPassword"]
                : undefined
            }
          />
        </div>

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? (
            <span className="inline-flex items-center gap-2">
              <LogoLoader size={16} label={null} />
              Salvando…
            </span>
          ) : (
            "Salvar nova senha"
          )}
        </Button>
      </form>
    </div>
  );
}
