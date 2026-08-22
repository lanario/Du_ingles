"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/form-message";

/**
 * Campo em pílula do card de acesso: ícone à esquerda, sem rótulo visível
 * (o placeholder já diz o que é, e o card não tem altura para duas linhas por
 * campo). O `<label>` continua no DOM em `sr-only` — sem ele o leitor de tela
 * ficaria só com o placeholder, que some assim que a pessoa digita.
 */

export interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  icon: ReactNode;
  errors?: string[];
}

export function AuthField({ id, label, icon, errors, ...props }: AuthFieldProps) {
  const invalid = Boolean(errors?.length);

  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>

      <div className="auth-field" data-invalid={invalid}>
        {icon}
        <input
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={`${id}-error`}
          {...props}
        />
      </div>

      <div id={`${id}-error`}>
        <FieldError messages={errors} />
      </div>
    </div>
  );
}
