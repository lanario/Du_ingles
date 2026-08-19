"use client";

/**
 * Campo de hora da plataforma. Substitui o `<input type="time">` nativo, que
 * cada navegador/SO desenha do seu jeito (e sempre fora da paleta) — aqui o
 * gatilho segue a mesma anatomia dos outros campos e a lista é nossa.
 *
 * O valor trafega em `HH:MM` (24h) num input escondido, então os
 * formulários/Server Actions continuam lendo `formData.get(name)` como antes.
 * Dá para digitar a hora direto ou escolher na lista — as duas vias convergem
 * no mesmo `commit`.
 */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { CheckIcon, ClockIcon, CloseIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/** Todas as horas do dia em passos de `step` minutos, ex.: 00:00, 00:30… */
function buildOptions(step: number): string[] {
  const options: string[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += step) {
    const h = String(Math.floor(minutes / 60)).padStart(2, "0");
    const m = String(minutes % 60).padStart(2, "0");
    options.push(`${h}:${m}`);
  }
  return options;
}

/** Só os dígitos digitados, com ":" inserido conforme o usuário avança. */
function maskTyped(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length > 2) return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  return digits;
}

/** `HH:MM` completo → normalizado, ou `null` se não for uma hora válida. */
function parseTyped(digits: string): string | null {
  if (digits.length !== 4) return null;
  const hours = Number(digits.slice(0, 2));
  const minutes = Number(digits.slice(2, 4));
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export type TimeFieldTone = "app" | "admin";

export interface TimeFieldProps {
  id?: string;
  /** Nome enviado no formulário; o valor sai em `HH:MM`. */
  name?: string;
  /** Controlado (`HH:MM` ou string vazia). */
  value?: string;
  /** Não controlado (`HH:MM` ou string vazia). */
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Intervalo entre as opções da lista, em minutos. */
  step?: number;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Paleta do chrome onde o campo vive. */
  tone?: TimeFieldTone;
  invalid?: boolean;
  className?: string;
  "aria-describedby"?: string;
  "aria-label"?: string;
}

export function TimeField({
  id,
  name,
  value,
  defaultValue,
  onChange,
  step = 30,
  required = false,
  disabled = false,
  placeholder = "--:--",
  tone = "app",
  invalid = false,
  className,
  "aria-describedby": describedBy,
  "aria-label": ariaLabel,
}: TimeFieldProps) {
  const controlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? "");
  const current = controlled ? (value ?? "") : internal;

  const options = useMemo(() => buildOptions(step), [step]);

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );
  const [mounted, setMounted] = useState(false);
  const reduceMotion = useReducedMotion();
  const admin = tone === "admin";
  const labelId = useId();

  // O que aparece no campo enquanto o usuário digita. Segue `current`
  // (seleção na lista), exceto durante a digitação — aí `typingRef` segura o
  // texto local até um `HH:MM` completo fechar uma hora válida ou o campo
  // perder o foco.
  const [text, setText] = useState(current);
  const typingRef = useRef(false);
  // Só a seta ↓ deve levar o foco para a lista (para navegar com o teclado).
  // Abrir por foco/clique no campo mantém o foco no input, para digitar.
  const keyboardOpenRef = useRef(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (typingRef.current) return;
    setText(current);
  }, [current]);

  const commit = useCallback(
    (next: string) => {
      if (!controlled) setInternal(next);
      onChange?.(next);
    },
    [controlled, onChange],
  );

  const openPicker = useCallback(() => {
    if (disabled) return;
    setOpen(true);
  }, [disabled]);

  const closePicker = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  /** Popover em portal + posição fixa: painéis e diálogos rolam e cortariam. */
  const place = useCallback(() => {
    const trigger = triggerRef.current?.closest("[data-time-field-root]") as HTMLElement | null;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const height = popoverRef.current?.offsetHeight ?? 240;
    const openUp = rect.bottom + height + 8 > window.innerHeight && rect.top > height + 8;
    setPosition({
      top: openUp ? rect.top - height - 6 : rect.bottom + 6,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // A seta ↓ no campo abre e já leva o foco para a lista, para navegar com o
  // teclado a partir daí. Abrir por clique ou por foco no campo (para
  // digitar) não rouba o foco do input.
  useEffect(() => {
    if (open && keyboardOpenRef.current) {
      listRef.current?.focus({ preventScroll: true });
      keyboardOpenRef.current = false;
    }
  }, [open]);

  // Ao abrir, rola até a opção selecionada (ou a mais próxima da hora atual).
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      listRef.current
        ?.querySelector<HTMLElement>('[aria-selected="true"]')
        ?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  function select(time: string) {
    commit(time);
    closePicker();
  }

  function onInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    typingRef.current = true;
    const masked = maskTyped(event.target.value);
    setText(masked);

    const digits = masked.replace(/\D/g, "");
    if (digits.length === 0) {
      commit("");
      return;
    }
    if (digits.length < 4) return;

    const time = parseTyped(digits);
    if (time) {
      commit(time);
      typingRef.current = false;
    }
  }

  /** Ao sair do campo, o texto sempre volta a refletir a hora válida (ou
   * fica vazio) — nunca deixa um `HH:MM` incompleto ou inválido preso. */
  function onInputBlur() {
    typingRef.current = false;
    setText(current);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      // Um <input> de texto dentro de <form> envia o form ao apertar Enter;
      // aqui isso não tem uso e derrubaria o formulário sem querer.
      event.preventDefault();
      return;
    }
    if (event.key === "ArrowDown" && !open) {
      event.preventDefault();
      keyboardOpenRef.current = true;
      openPicker();
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      closePicker(false);
    }
  }

  function onListKeyDown(event: React.KeyboardEvent<HTMLUListElement>) {
    const index = Math.max(options.indexOf(current), -1);
    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        const next = options[Math.min(index + 1, options.length - 1)];
        if (next) select(next);
        listRef.current?.focus({ preventScroll: true });
        setOpen(true);
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        const next = options[Math.max(index - 1, 0)];
        if (next) select(next);
        listRef.current?.focus({ preventScroll: true });
        setOpen(true);
        break;
      }
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        closePicker();
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  const popover = (
    <motion.div
      key="time-field-popover"
      ref={popoverRef}
      role="dialog"
      aria-modal="false"
      id={`${labelId}-popover`}
      aria-labelledby={labelId}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        closePicker();
      }}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
      style={{
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        width: position?.width,
        visibility: position ? "visible" : "hidden",
      }}
      className={cn(
        "fixed z-[60] origin-top overflow-hidden rounded-xl border shadow-[var(--shadow-card-hover)]",
        admin ? "border-admin-border bg-admin-surface" : "border-border bg-background",
      )}
    >
      <ul
        ref={listRef}
        role="listbox"
        id={labelId}
        tabIndex={-1}
        onKeyDown={onListKeyDown}
        className="max-h-64 overflow-y-auto p-1.5 focus:outline-none"
      >
        {options.map((time) => {
          const selected = time === current;
          return (
            <li
              key={time}
              role="option"
              aria-selected={selected}
              onClick={() => select(time)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm tabular transition-colors",
                admin ? "hover:bg-admin-muted" : "hover:bg-gold-50",
                selected
                  ? admin
                    ? "font-semibold text-admin-foreground"
                    : "font-semibold text-navy-900"
                  : admin
                    ? "text-admin-foreground/80"
                    : "text-foreground",
              )}
            >
              <span className="flex-1">{time}</span>
              {selected && <CheckIcon className="h-3.5 w-3.5 flex-none text-gold-600" />}
            </li>
          );
        })}
      </ul>
    </motion.div>
  );

  return (
    <div ref={rootRef} data-time-field-root className="relative">
      {name && (
        <input
          type="hidden"
          name={name}
          value={current}
          // `required` num input escondido travaria o submit sem mensagem
          // visível; a obrigatoriedade é validada no servidor (Zod).
          readOnly
        />
      )}

      <div
        className={cn(
          "flex h-10 items-center gap-2 rounded-md border px-3 text-left text-sm transition-colors",
          admin
            ? "border-admin-border bg-admin-background text-admin-foreground"
            : "border-border bg-background text-foreground",
          open && "border-gold-500 ring-2 ring-gold-500/25",
          invalid && "border-destructive",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          disabled={disabled}
          // Clicar no ícone é o mesmo que clicar no campo: abre a lista e
          // leva o foco para lá, para digitar em seguida.
          onClick={() => {
            openPicker();
            triggerRef.current?.focus();
          }}
          className="flex-none text-gold-600 disabled:cursor-not-allowed"
        >
          <ClockIcon className="h-4 w-4" />
        </button>

        <input
          ref={triggerRef}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          role="combobox"
          aria-controls={`${labelId}-popover`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-describedby={describedBy}
          aria-label={ariaLabel}
          data-required={required || undefined}
          data-invalid={invalid || undefined}
          disabled={disabled}
          value={text}
          placeholder={placeholder}
          onChange={onInputChange}
          onFocus={() => !disabled && openPicker()}
          onBlur={onInputBlur}
          onKeyDown={onInputKeyDown}
          className={cn(
            "w-[3.6rem] min-w-0 flex-1 bg-transparent tabular outline-none",
            admin ? "placeholder:text-admin-foreground/40" : "placeholder:text-muted-foreground",
            disabled && "cursor-not-allowed",
          )}
        />

        {current && !disabled && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Limpar hora"
            onClick={() => commit("")}
            className={cn(
              "flex-none rounded-md transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
              admin
                ? "text-admin-foreground/40 hover:text-admin-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {mounted && createPortal(open ? popover : null, document.body)}
    </div>
  );
}
