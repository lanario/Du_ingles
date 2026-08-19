"use client";

import { useActionState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { requestDataDeletionAction } from "@/actions/shared/lgpd";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/ui/form-message";
import { cn } from "@/lib/utils";

export function LgpdPanel({ theme = "app" }: { theme?: "app" | "admin" }) {
  const [state, formAction, isPending] = useActionState(requestDataDeletionAction, null);
  const reduceMotion = useReducedMotion();

  const cardClass =
    theme === "admin"
      ? "rounded-lg border border-admin-border p-4"
      : "rounded-2xl border border-border bg-background p-5 shadow-[var(--shadow-card)]";
  const mutedClass =
    theme === "admin"
      ? "text-sm text-admin-foreground/70"
      : "text-sm text-muted-foreground";
  const headingClass = theme === "admin" ? "font-semibold" : "font-semibold text-navy-900";

  const exportSection = (
    <>
      <h2 className={headingClass}>Exportar meus dados</h2>
      <p className={cn("mt-1", mutedClass)}>
        Baixe uma cópia de todos os seus dados pessoais registrados na plataforma, em
        formato JSON.
      </p>
      <a href="/api/lgpd/export" className="mt-4 inline-block">
        <Button type="button" variant="outline">
          Baixar meus dados
        </Button>
      </a>
    </>
  );

  const deletionSection = (
    <>
      <h2 className={headingClass}>Solicitar exclusão da conta</h2>
      <p className={cn("mt-1", mutedClass)}>
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
          <Button type="submit" variant="destructive" disabled={isPending} className="mt-2">
            {isPending ? "Enviando…" : "Solicitar exclusão"}
          </Button>
        </form>
      )}
    </>
  );

  if (theme === "admin") {
    return (
      <div className="max-w-xl space-y-6">
        <div className={cardClass}>{exportSection}</div>
        <div className={cardClass}>{deletionSection}</div>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: "easeOut" }}
        className={cardClass}
      >
        {exportSection}
      </motion.div>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, delay: 0.06, ease: "easeOut" }}
        className={cardClass}
      >
        {deletionSection}
      </motion.div>
    </div>
  );
}
