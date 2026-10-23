"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_DDI,
  PHONE_COUNTRIES,
  composePhone,
  formatNationalNumber,
  onlyDigits,
  splitPhone,
} from "@/lib/phone";

export interface PhoneInputProps {
  /** Nome do campo enviado ao servidor: "+55 (21) 96641-8522". */
  name: string;
  id?: string;
  defaultValue?: string | null;
  /** Modo controlado: recebe o valor composto a cada mudança. */
  value?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  invalid?: boolean;
  className?: string;
  selectClassName?: string;
  inputClassName?: string;
}

/**
 * Telefone com DDI +55 por padrão (editável pelo usuário) e número formatado
 * logo depois (`(21) 96641-8522`). Quando o número está vazio, o campo oculto
 * envia string vazia para preservar campos opcionais; preenchido, envia
 * `+55 (21) 96641-8522` (ou o DDI escolhido).
 */
export function PhoneInput({
  name,
  id,
  defaultValue,
  value,
  onValueChange,
  required,
  placeholder,
  autoComplete = "tel-national",
  invalid,
  className,
  selectClassName,
  inputClassName,
}: PhoneInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listId = `${generatedId}-ddi-list`;
  const initial = splitPhone(value ?? defaultValue);
  const [ddi, setDdi] = useState(initial.ddi || DEFAULT_DDI);
  const [national, setNational] = useState(
    formatNationalNumber(initial.ddi || DEFAULT_DDI, initial.national),
  );

  // Modo controlado: acompanha mudanças externas (ex.: estado inicial ou reset).
  const [lastValue, setLastValue] = useState(value);
  if (value !== undefined && value !== lastValue) {
    setLastValue(value);
    const activeDdi = onlyDigits(ddi) || DEFAULT_DDI;
    if (value !== composePhone(activeDdi, national)) {
      const next = splitPhone(value);
      setDdi(next.ddi);
      setNational(formatNationalNumber(next.ddi, next.national));
    }
  }

  const cleanDdi = onlyDigits(ddi) || DEFAULT_DDI;
  const composed = composePhone(cleanDdi, national);

  function emit(nextDdi: string, nextNational: string) {
    const normalizedDdi = onlyDigits(nextDdi) || DEFAULT_DDI;
    onValueChange?.(composePhone(normalizedDdi, nextNational));
  }

  const isBrazil = cleanDdi === "55";

  return (
    <div className={cn("flex items-stretch gap-2", className)}>
      <input
        type="text"
        inputMode="tel"
        list={listId}
        aria-label="Código do país (DDI)"
        value={`+${ddi}`}
        onChange={(event) => {
          const nextDdi = onlyDigits(event.target.value).slice(0, 4);
          const effectiveDdi = nextDdi || DEFAULT_DDI;
          const reformatted = formatNationalNumber(effectiveDdi, onlyDigits(national));
          setDdi(nextDdi);
          setNational(reformatted);
          emit(effectiveDdi, reformatted);
        }}
        onBlur={() => {
          if (!onlyDigits(ddi)) {
            setDdi(DEFAULT_DDI);
            const reformatted = formatNationalNumber(DEFAULT_DDI, onlyDigits(national));
            setNational(reformatted);
            emit(DEFAULT_DDI, reformatted);
          }
        }}
        className={cn(
          "w-[4.5rem] shrink-0 rounded-xl border border-border bg-background px-2.5 py-3 text-center text-sm font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15",
          selectClassName,
        )}
      />
      <datalist id={listId}>
        {PHONE_COUNTRIES.map((entry) => (
          <option key={entry.ddi} value={`+${entry.ddi}`}>
            {entry.flag} {entry.name} (+{entry.ddi})
          </option>
        ))}
      </datalist>
      <input
        id={inputId}
        type="tel"
        inputMode="tel"
        autoComplete={autoComplete}
        required={required}
        value={national}
        placeholder={placeholder ?? (isBrazil ? "(21) 99999-8888" : "Número com DDD / área")}
        aria-invalid={invalid ? true : undefined}
        onChange={(event) => {
          const raw = event.target.value;
          // Se o usuário colar o número completo com +DDI (ex.: +55 21 96641-8522)
          if (raw.trim().startsWith("+")) {
            const parsed = splitPhone(raw);
            const formatted = formatNationalNumber(parsed.ddi, parsed.national);
            setDdi(parsed.ddi);
            setNational(formatted);
            emit(parsed.ddi, formatted);
            return;
          }
          let digits = onlyDigits(raw);
          if (cleanDdi === "55" && digits.startsWith("55") && digits.length > 11) {
            digits = digits.slice(2);
          }
          const formatted = formatNationalNumber(cleanDdi, digits);
          setNational(formatted);
          emit(cleanDdi, formatted);
        }}
        className={cn(
          "min-w-0 flex-1 rounded-xl border border-border bg-background px-3.5 py-3 text-sm font-normal text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/15 aria-invalid:border-destructive",
          inputClassName,
        )}
      />
      <input type="hidden" name={name} value={composed} data-error-anchor={name} />
    </div>
  );
}
