"use client";

import { useActionState } from "react";
import { requestDataDeletionAction } from "@/actions/shared/lgpd";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/ui/form-message";

export function LgpdPanel({ theme = "app" }: { theme?: "app" | "admin" }) {
  const [state, formAction, isPending] = useActionState(requestDataDeletionAction, null);

  const cardClass =
    theme === "admin"
      ? "rounded-lg border border-admin-border p-4"
      : "rounded-lg border border-border p-4";
  const mutedClass =
    theme === "admin"
      ? "text-sm text-admin-foreground/70"
      : "text-sm text-muted-foreground";

  return (
    <div className="max-w-xl space-y-8">
      <section className={cardClass}>
        <h2 className="font-semibold">Exportar meus dados</h2>
        <p className={`mt-1 ${mutedClass}`}>
          Baixe uma cópia de todos os seus dados pessoais registrados na plataforma, em
          formato JSON.
        </p>
        <a href="/api/lgpd/export" className="mt-4 inline-block">
          <Button type="button" variant="outline">
            Baixar meus dados
          </Button>
        </a>
      </section>

      <section className={cardClass}>
        <h2 className="font-semibold">Solicitar exclusão da conta</h2>
        <p className={`mt-1 ${mutedClass}`}>
          Você pode solicitar a exclusão dos seus dados pessoais a qualquer momento. Como
          alguns registros pedagógicos têm prazo de retenção contratual, um administrador
          vai revisar o pedido antes de concluir a exclusão.
        </p>
        {state?.success ? (
          <FormBanner tone="success">
            Solicitação enviada. Um administrador foi notificado.
          </FormBanner>
        ) : (
          <form action={formAction} className="mt-4">
            {state && !state.success && (
              <FormBanner tone="error">{state.error.message}</FormBanner>
            )}
            <Button
              type="submit"
              variant="destructive"
              disabled={isPending}
              className="mt-2"
            >
              {isPending ? "Enviando…" : "Solicitar exclusão"}
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}
