"use client";

import { useActionState } from "react";
import { createLeadAction } from "@/actions/leads/create-lead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormBanner } from "@/components/ui/form-message";

export function ContactForm() {
  const [state, formAction, isPending] = useActionState(createLeadAction, null);

  if (state?.success) {
    return (
      <FormBanner tone="success">
        Recebemos seu contato! Nossa equipe fala com você em breve para agendar a aula
        experimental.
      </FormBanner>
    );
  }

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2" noValidate>
      {state && !state.success && !state.error.fields && (
        <div className="sm:col-span-2">
          <FormBanner tone="error">{state.error.message}</FormBanner>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" required autoComplete="name" />
        <FieldError
          messages={state && !state.success ? state.error.fields?.["name"] : undefined}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
        <FieldError
          messages={state && !state.success ? state.error.fields?.["email"] : undefined}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">Telefone (opcional)</Label>
        <Input id="phone" name="phone" type="tel" autoComplete="tel" />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="message">Mensagem (opcional)</Label>
        <textarea
          id="message"
          name="message"
          rows={3}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="sm:col-span-2">
        <Button type="submit" className="w-full sm:w-auto" disabled={isPending}>
          {isPending ? "Enviando…" : "Agendar aula experimental"}
        </Button>
      </div>
    </form>
  );
}
