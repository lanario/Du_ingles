"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createLeadAction } from "@/actions/leads/create-lead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { FieldError, FormBanner } from "@/components/ui/form-message";
import { LogoLoader } from "@/components/ui/logo-loader";

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
        <PhoneInput
          id="phone"
          name="phone"
          invalid={Boolean(state && !state.success && state.error.fields?.["phone"]?.length)}
          selectClassName="h-10 rounded-md"
          inputClassName="h-10 rounded-md py-2"
        />
        <FieldError
          messages={state && !state.success ? state.error.fields?.["phone"] : undefined}
        />
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

      <div className="space-y-1.5 sm:col-span-2">
        <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
          <input
            type="checkbox"
            name="consent"
            required
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
          />
          <span>
            Li a{" "}
            <Link href="/privacidade" className="underline" target="_blank">
              política de privacidade
            </Link>{" "}
            e autorizo o Du Inglês a usar estes dados para responder a este contato.
          </span>
        </label>
        <FieldError
          messages={state && !state.success ? state.error.fields?.["consent"] : undefined}
        />
      </div>

      <div className="sm:col-span-2">
        <Button type="submit" className="w-full sm:w-auto" disabled={isPending}>
          {isPending ? (
            <span className="inline-flex items-center gap-2">
              <LogoLoader size={16} label={null} />
              Enviando…
            </span>
          ) : (
            "Agendar aula experimental"
          )}
        </Button>
      </div>
    </form>
  );
}
