"use client";

/**
 * Medidor de força de senha. Quatro blocos, rótulo e a lista do que ainda
 * falta — a lista é o que resolve de verdade, porque "fraca" sozinha não
 * diz o que fazer.
 *
 * As regras vêm de `lib/password-strength.ts`, que espelha `passwordRules`
 * de `schemas/auth.ts`: o medidor nunca aprova o que o servidor recusa.
 */

import { CheckIcon, CloseIcon } from "@/components/ui/icons";
import { checkPassword, type PasswordLevel } from "@/lib/password-strength";
import { cn } from "@/lib/utils";

const TONE: Record<PasswordLevel, string> = {
  empty: "var(--border)",
  weak: "var(--destructive)",
  fair: "var(--warning)",
  good: "var(--navy-500)",
  strong: "var(--success)",
};

export function PasswordStrength({
  value,
  /** Lista de exigências — dispensável no campo de confirmação. */
  showChecklist = true,
  className,
}: {
  value: string;
  showChecklist?: boolean;
  className?: string;
}) {
  const strength = checkPassword(value);
  const tone = TONE[strength.level];

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1" aria-hidden>
          {[0, 1, 2, 3].map((index) => (
            <span key={index} className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              {/*
                Transição em CSS pura: são quatro blocos que só mudam
                `transform` e `background-color` a cada tecla. Não há aqui
                nada que justifique carregar o Framer — e o alvo fica no
                `style`, legível e testável sem esperar animação.
              */}
              <span
                className="block h-full w-full origin-left rounded-full transition-[transform,background-color] duration-300 ease-out"
                style={{
                  transform: `scaleX(${index < strength.score ? 1 : 0})`,
                  backgroundColor: tone,
                }}
              />
            </span>
          ))}
        </div>
        <span
          className="w-16 shrink-0 text-right text-xs font-medium tabular-nums"
          style={{ color: strength.level === "empty" ? undefined : tone }}
        >
          {strength.label}
        </span>
      </div>

      {/*
        `aria-live` em vez de `role="alert"`: o leitor de tela anuncia a
        mudança sem interromper quem ainda está digitando.
      */}
      <p className="sr-only" aria-live="polite">
        {strength.label ? `Força da senha: ${strength.label}.` : ""}
      </p>

      {showChecklist && (
        <ul className="grid gap-1 sm:grid-cols-2">
          {strength.checks.map((check) => (
            <li
              key={check.id}
              className={cn(
                "flex items-center gap-1.5 text-xs transition-colors",
                check.met ? "text-[color:var(--success)]" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full",
                  check.met ? "bg-[color:var(--success)]/12" : "bg-muted",
                )}
              >
                {check.met ? (
                  <CheckIcon className="h-2.5 w-2.5" />
                ) : (
                  <span className="h-1 w-1 rounded-full bg-current opacity-50" />
                )}
              </span>
              {check.label}
              {!check.required && !check.met && (
                <span className="text-[10px] opacity-60">(opcional)</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Estado do campo "confirmar senha". Some enquanto o campo está vazio: um
 * "não coincidem" no primeiro caractere digitado é ruído, não ajuda.
 */
export function PasswordMatch({ password, confirm }: { password: string; confirm: string }) {
  if (confirm.length === 0) return null;
  const matches = password === confirm;

  return (
    <p
      aria-live="polite"
      className={cn(
        "flex items-center gap-1.5 text-xs",
        matches ? "text-[color:var(--success)]" : "text-destructive",
      )}
    >
      {matches ? <CheckIcon className="h-3 w-3" /> : <CloseIcon className="h-3 w-3" />}
      {matches ? "As senhas coincidem." : "As senhas não coincidem."}
    </p>
  );
}
