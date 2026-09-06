"use client";

/**
 * Cadastro do convidado. É a porta de entrada de quem veio do WhatsApp:
 * nome, e-mail, nascimento, CPF e senha — tudo obrigatório, porque é este
 * formulário que forma o perfil inteiro (não há etapa depois).
 *
 * O telefone aparece travado: ele veio do convite, é o número que recebeu
 * o link, e não é enviado pelo formulário — a server action lê do convite.
 * Deixá-lo editável seria deixar alguém se cadastrar com outro número.
 *
 * Sobre o erro: nunca "dados inválidos". A recusa chega por campo
 * (`schemas/field-messages.ts`) e a tela mostra três camadas — o resumo no topo
 * com o nome de cada campo recusado, a borda vermelha no campo e o texto
 * embaixo dele dizendo o que fazer. O foco vai para o primeiro erro, que num
 * formulário desta altura costuma estar fora da tela.
 */

import { useActionState, useEffect, useRef, useState } from "react";
import { acceptInviteAction } from "@/actions/auth/accept-invite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/ui/date-field";
import { Label } from "@/components/ui/label";
import { FieldError, FormBanner } from "@/components/ui/form-message";
import { PasswordMatch, PasswordStrength } from "@/components/ui/password-strength";
import { EyeIcon, LockIcon } from "@/components/ui/icons";
import { formatCpf } from "@/lib/cpf";
import { ACCEPT_INVITE_FIELDS } from "@/schemas/invites";
import { cn } from "@/lib/utils";

export function AcceptInviteForm({
  token,
  defaultFullName,
  phoneDisplay,
}: {
  token: string;
  defaultFullName: string;
  phoneDisplay: string;
}) {
  const action = acceptInviteAction.bind(null, token);
  const [state, formAction, isPending] = useActionState(action, null);

  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const fields = state && !state.success ? state.error.fields : undefined;
  const message = state && !state.success ? state.error.message : undefined;

  /** Campos recusados, na ordem da tela — é a ordem em que a pessoa lê. */
  const invalidFields = ACCEPT_INVITE_FIELDS.filter(([name]) => fields?.[name]?.length);
  const formRef = useRef<HTMLFormElement>(null);

  // O primeiro campo com erro pode estar acima ou abaixo do que está visível (o
  // formulário tem seis campos e um medidor de senha no meio). Levar o foco até
  // ele é o que evita o "deu erro e eu não sei onde".
  useEffect(() => {
    const first = invalidFields[0]?.[0];
    if (!first) return;
    const element = document.getElementById(first);
    element?.focus({ preventScroll: true });
    element?.scrollIntoView({ block: "center", behavior: "smooth" });
    // Depende só de `state`: ele é um objeto novo a cada submit, então
    // reenviar sem corrigir nada reposiciona o foco em vez de parecer que
    // nada aconteceu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const errorProps = (name: string) =>
    fields?.[name]?.length
      ? { "aria-invalid": true as const, "aria-describedby": `${name}-error` }
      : {};

  return (
    <form ref={formRef} action={formAction} className="space-y-5" noValidate>
      {message && (
        <FormBanner tone="error">
          <p className="font-medium">{message}</p>
          {invalidFields.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {invalidFields.map(([name, label]) => (
                <li key={name}>
                  <a href={`#${name}`} className="underline underline-offset-2">
                    {label}
                  </a>
                  {`: ${fields?.[name]?.[0] ?? ""}`}
                </li>
              ))}
            </ul>
          )}
        </FormBanner>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="fullName">Nome completo</Label>
        <Input
          id="fullName"
          name="fullName"
          defaultValue={defaultFullName}
          autoComplete="name"
          required
          {...errorProps("fullName")}
        />
        <FieldError id="fullName-error" messages={fields?.["fullName"]} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone-display">WhatsApp</Label>
        <div className="relative">
          <Input
            id="phone-display"
            value={phoneDisplay}
            readOnly
            disabled
            aria-describedby="phone-hint"
            className="bg-muted pr-10 text-muted-foreground"
          />
          <LockIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        <p id="phone-hint" className="text-xs text-muted-foreground">
          Número que recebeu este convite. Para alterar, fale com a escola.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="voce@email.com"
          required
          {...errorProps("email")}
        />
        <FieldError id="email-error" messages={fields?.["email"]} />
        <p className="text-xs text-muted-foreground">Será o seu login na plataforma.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="birthDate">Data de nascimento</Label>
          <DateField
            id="birthDate"
            name="birthDate"
            required
            max={new Date().toISOString().slice(0, 10)}
            invalid={Boolean(fields?.["birthDate"]?.length)}
            aria-describedby={
              fields?.["birthDate"]?.length ? "birthDate-error" : undefined
            }
          />
          <FieldError id="birthDate-error" messages={fields?.["birthDate"]} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cpf">CPF</Label>
          <Input
            id="cpf"
            name="cpf"
            inputMode="numeric"
            value={cpf}
            onChange={(event) => setCpf(formatCpf(event.target.value))}
            placeholder="000.000.000-00"
            required
            {...errorProps("cpf")}
          />
          <FieldError id="cpf-error" messages={fields?.["cpf"]} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Senha</Label>
        <PasswordField
          id="password"
          name="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          errors={fields?.["password"]}
        />
        <PasswordStrength value={password} className="pt-1" />
        <FieldError id="password-error" messages={fields?.["password"]} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirmar senha</Label>
        <PasswordField
          id="confirmPassword"
          name="confirmPassword"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          errors={fields?.["confirmPassword"]}
        />
        <PasswordStrength value={confirm} showChecklist={false} className="pt-1" />
        <PasswordMatch password={password} confirm={confirm} />
        <FieldError id="confirmPassword-error" messages={fields?.["confirmPassword"]} />
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Criando acesso…" : "Criar acesso e entrar"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Ao concluir, você concorda com os{" "}
        <a href="/termos" className="underline hover:text-foreground">
          termos de uso
        </a>{" "}
        e a{" "}
        <a href="/privacidade" className="underline hover:text-foreground">
          política de privacidade
        </a>
        .
      </p>
    </form>
  );
}

/** Campo de senha com olho de revelar — o padrão que evita erro de digitação às cegas. */
function PasswordField({
  id,
  name,
  value,
  onChange,
  autoComplete,
  errors,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  errors?: string[];
}) {
  const [visible, setVisible] = useState(false);
  const invalid = Boolean(errors?.length);

  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        required
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        className="pr-11"
      />
      <button
        type="button"
        onClick={() => setVisible((previous) => !previous)}
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={visible}
        className={cn(
          "absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-2 transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          visible ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <EyeIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
