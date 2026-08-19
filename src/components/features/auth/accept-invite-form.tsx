"use client";

/**
 * Cadastro do convidado. É a porta de entrada de quem veio do WhatsApp:
 * nome, e-mail, nascimento, CPF e senha — tudo obrigatório, porque é este
 * formulário que forma o perfil inteiro (não há etapa depois).
 *
 * O telefone aparece travado: ele veio do convite, é o número que recebeu
 * o link, e não é enviado pelo formulário — a server action lê do convite.
 * Deixá-lo editável seria deixar alguém se cadastrar com outro número.
 */

import { useActionState, useState } from "react";
import { acceptInviteAction } from "@/actions/auth/accept-invite";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormBanner } from "@/components/ui/form-message";
import { PasswordMatch, PasswordStrength } from "@/components/ui/password-strength";
import { EyeIcon, LockIcon } from "@/components/ui/icons";
import { formatCpf } from "@/lib/cpf";
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

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state && !state.success && !state.error.fields && (
        <FormBanner tone="error">{state.error.message}</FormBanner>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="fullName">Nome completo</Label>
        <Input
          id="fullName"
          name="fullName"
          defaultValue={defaultFullName}
          autoComplete="name"
          required
        />
        <FieldError messages={fields?.["fullName"]} />
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
        />
        <FieldError messages={fields?.["email"]} />
        <p className="text-xs text-muted-foreground">
          Será o seu login na plataforma.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="birthDate">Data de nascimento</Label>
          <Input
            id="birthDate"
            name="birthDate"
            type="date"
            autoComplete="bday"
            required
          />
          <FieldError messages={fields?.["birthDate"]} />
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
          />
          <FieldError messages={fields?.["cpf"]} />
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
        />
        <PasswordStrength value={password} className="pt-1" />
        <FieldError messages={fields?.["password"]} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirmar senha</Label>
        <PasswordField
          id="confirmPassword"
          name="confirmPassword"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
        />
        <PasswordStrength value={confirm} showChecklist={false} className="pt-1" />
        <PasswordMatch password={password} confirm={confirm} />
        <FieldError messages={fields?.["confirmPassword"]} />
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
}: {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);

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
