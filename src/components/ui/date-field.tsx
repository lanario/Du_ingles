"use client";

/**
 * Campo de data da plataforma. Substitui o `<input type="date">` nativo, que
 * cada navegador desenha do seu jeito (e sempre fora da paleta) — aqui o
 * gatilho segue a mesma anatomia dos outros campos e o calendário é nosso.
 *
 * O valor trafega em ISO (`yyyy-mm-dd`) num input escondido, então os
 * formulários/Server Actions continuam lendo `formData.get(name)` como antes.
 * A leitura na tela é `dd/mm/aaaa`, no formato brasileiro.
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
import { CalendarIcon, ChevronIcon, CloseIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const MONTHS_SHORT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

/** Semana começando na segunda, como nos calendários de aula. */
const WEEKDAYS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

/** ISO → `Date` local. `new Date("2026-08-19")` seria UTC e voltaria um dia. */
function parseISO(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toISO(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function format(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

/** Só os dígitos digitados, com "/" inseridos conforme o usuário avança. */
function maskTyped(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length > 4) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

/** `dd/mm/aaaa` completo → `Date`, ou `null` se os 8 dígitos não formam uma
 * data real (ex.: 31/02). Não confere `min`/`max` — isso é papel de quem
 * chama, que já tem `outOfRange` à mão. */
function parseTyped(digits: string): Date | null {
  if (digits.length !== 8) return null;
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  const date = new Date(year, month - 1, day);
  const isRealDate =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return isRealDate ? date : null;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

/** As 42 células (6 semanas) da grade do mês, incluindo as bordas vizinhas. */
function buildGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = addDays(first, -offset);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export type DateFieldTone = "app" | "admin";

export interface DateFieldProps {
  id?: string;
  /** Nome enviado no formulário; o valor sai em ISO (`yyyy-mm-dd`). */
  name?: string;
  /** Controlado (ISO ou string vazia). */
  value?: string;
  /** Não controlado (ISO ou string vazia). */
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Limites em ISO — dias fora da faixa ficam desabilitados. */
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Paleta do chrome onde o campo vive. */
  tone?: DateFieldTone;
  invalid?: boolean;
  className?: string;
  "aria-describedby"?: string;
  "aria-label"?: string;
}

export function DateField({
  id,
  name,
  value,
  defaultValue,
  onChange,
  min,
  max,
  required = false,
  disabled = false,
  placeholder = "dd/mm/aaaa",
  tone = "app",
  invalid = false,
  className,
  "aria-describedby": describedBy,
  "aria-label": ariaLabel,
}: DateFieldProps) {
  const controlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? "");
  const current = controlled ? (value ?? "") : internal;

  const selected = useMemo(() => parseISO(current), [current]);
  const minDate = useMemo(() => parseISO(min), [min]);
  const maxDate = useMemo(() => parseISO(max), [max]);
  const today = useMemo(() => startOfDay(new Date()), []);

  const [open, setOpen] = useState(false);
  const [pickingMonth, setPickingMonth] = useState(false);
  const [month, setMonth] = useState<Date>(
    () => selected ?? new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [focused, setFocused] = useState<Date>(() => selected ?? today);

  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const reduceMotion = useReducedMotion();
  const admin = tone === "admin";
  const labelId = useId();

  // O que aparece no campo enquanto o usuário digita. Segue `selected`
  // (clique no calendário, "Hoje", "Limpar"), exceto durante a digitação —
  // aí `typingRef` segura o texto local até um `dd/mm/aaaa` completo fechar
  // uma data válida ou o campo perder o foco.
  const [text, setText] = useState(() => (selected ? format(selected) : ""));
  const typingRef = useRef(false);
  // Só a seta ↓ deve levar o foco para a grade (para navegar com o teclado).
  // Abrir por foco/clique no campo mantém o foco no input, para digitar.
  const keyboardOpenRef = useRef(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (typingRef.current) return;
    setText(selected ? format(selected) : "");
  }, [selected]);

  const commit = useCallback(
    (next: string) => {
      if (!controlled) setInternal(next);
      onChange?.(next);
    },
    [controlled, onChange],
  );

  const openPicker = useCallback(() => {
    if (disabled) return;
    const base = parseISO(current) ?? today;
    setMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    setFocused(base);
    setPickingMonth(false);
    setOpen(true);
  }, [current, disabled, today]);

  const closePicker = useCallback(
    (refocus = true) => {
      setOpen(false);
      setPickingMonth(false);
      if (refocus) triggerRef.current?.focus();
    },
    [],
  );

  /** Popover em portal + posição fixa: painéis e diálogos rolam e cortariam. */
  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = 320;
    const height = popoverRef.current?.offsetHeight ?? 360;
    // A grade de dias e o seletor de mês/ano têm alturas diferentes. Decidir
    // pra cima/pra baixo com a altura da view atual faria o popover pular de
    // lado ao trocar entre elas (o painel abria pra cima na grade e, ao
    // clicar no mês, viraria pra baixo). Usa a maior altura possível (a da
    // grade, sempre >= a do seletor) só pra essa decisão, que então fica
    // estável nas duas views — o `top` continua usando a altura real.
    const maxHeight = Math.max(height, 400);
    const openUp = rect.bottom + maxHeight + 8 > window.innerHeight && rect.top > maxHeight + 8;
    const left = Math.min(
      Math.max(8, rect.left),
      Math.max(8, window.innerWidth - width - 8),
    );
    setPosition({ top: openUp ? rect.top - height - 6 : rect.bottom + 6, left });
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
  }, [open, pickingMonth, place]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
      setPickingMonth(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // A seta ↓ no campo abre e já leva o foco para a grade, para navegar com o
  // teclado a partir daí. Abrir por clique ou por foco no campo (para
  // digitar) não rouba o foco do input.
  useEffect(() => {
    if (open && !pickingMonth && keyboardOpenRef.current) {
      gridRef.current?.focus({ preventScroll: true });
      keyboardOpenRef.current = false;
    }
  }, [open, pickingMonth]);

  function outOfRange(date: Date): boolean {
    if (minDate && date < startOfDay(minDate)) return true;
    if (maxDate && date > startOfDay(maxDate)) return true;
    return false;
  }

  function select(date: Date) {
    if (outOfRange(date)) return;
    commit(toISO(date));
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
    if (digits.length < 8) return;

    const date = parseTyped(digits);
    if (date && !outOfRange(date)) {
      commit(toISO(date));
      setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
      setFocused(date);
      typingRef.current = false;
    }
  }

  /** Ao sair do campo, o texto sempre volta a refletir a data válida (ou
   * fica vazio) — nunca deixa um `dd/mm/aaaa` incompleto ou inválido preso. */
  function onInputBlur() {
    typingRef.current = false;
    setText(selected ? format(selected) : "");
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

  function moveFocus(next: Date) {
    setFocused(next);
    if (
      next.getMonth() !== month.getMonth() ||
      next.getFullYear() !== month.getFullYear()
    ) {
      setMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    }
  }

  function onGridKeyDown(event: React.KeyboardEvent) {
    const keys = [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
      "PageUp",
      "PageDown",
      "Enter",
      " ",
      "Escape",
    ];
    if (!keys.includes(event.key)) return;
    // O diálogo/painel também escuta Esc — sem isto, fechariam junto.
    event.preventDefault();
    event.stopPropagation();

    switch (event.key) {
      case "ArrowLeft":
        moveFocus(addDays(focused, -1));
        break;
      case "ArrowRight":
        moveFocus(addDays(focused, 1));
        break;
      case "ArrowUp":
        moveFocus(addDays(focused, -7));
        break;
      case "ArrowDown":
        moveFocus(addDays(focused, 7));
        break;
      case "Home":
        moveFocus(addDays(focused, -((focused.getDay() + 6) % 7)));
        break;
      case "End":
        moveFocus(addDays(focused, 6 - ((focused.getDay() + 6) % 7)));
        break;
      case "PageUp":
        moveFocus(addMonths(focused, -1));
        break;
      case "PageDown":
        moveFocus(addMonths(focused, 1));
        break;
      case "Enter":
      case " ":
        select(focused);
        break;
      case "Escape":
        closePicker();
        break;
    }
  }

  const grid = useMemo(() => buildGrid(month), [month]);

  const navButton = cn(
    "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
    admin
      ? "text-admin-foreground/60 hover:bg-admin-muted hover:text-admin-foreground"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
    "disabled:cursor-not-allowed disabled:opacity-30",
  );

  const popover = (
    <motion.div
      key="date-field-popover"
      ref={popoverRef}
      role="dialog"
      aria-modal="false"
      id={`${labelId}-popover`}
      aria-labelledby={labelId}
      // Esc fecha só o calendário: sem isto o Dialog/SidePanel ao redor
      // escutaria a mesma tecla e fecharia o formulário inteiro.
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
        visibility: position ? "visible" : "hidden",
      }}
      className={cn(
        "fixed z-[60] w-80 origin-top overflow-hidden rounded-xl border shadow-[var(--shadow-card-hover)]",
        admin ? "border-admin-border bg-admin-surface" : "border-border bg-background",
      )}
    >
      <div className="flex items-center justify-between gap-1 px-3 pt-3">
        <button
          type="button"
          className={navButton}
          aria-label="Mês anterior"
          onClick={() => setMonth(addMonths(month, -1))}
        >
          <ChevronIcon className="h-4 w-4 rotate-180" />
        </button>
        <button
          type="button"
          id={labelId}
          onClick={() => setPickingMonth((v) => !v)}
          aria-expanded={pickingMonth}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-semibold transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
            admin
              ? "text-admin-foreground hover:bg-admin-muted"
              : "text-navy-900 hover:bg-muted",
          )}
        >
          {MONTHS[month.getMonth()]} {month.getFullYear()}
          <ChevronIcon
            className={cn(
              "h-3.5 w-3.5 text-gold-600 transition-transform",
              pickingMonth ? "-rotate-90" : "rotate-90",
            )}
          />
        </button>
        <button
          type="button"
          className={navButton}
          aria-label="Próximo mês"
          onClick={() => setMonth(addMonths(month, 1))}
        >
          <ChevronIcon className="h-4 w-4" />
        </button>
      </div>

      {pickingMonth ? (
        <div className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              className={navButton}
              aria-label="Ano anterior"
              onClick={() => setMonth(addMonths(month, -12))}
            >
              <ChevronIcon className="h-4 w-4 rotate-180" />
            </button>
            <span
              className={cn(
                "text-sm font-semibold tabular",
                admin ? "text-admin-foreground" : "text-navy-900",
              )}
            >
              {month.getFullYear()}
            </span>
            <button
              type="button"
              className={navButton}
              aria-label="Próximo ano"
              onClick={() => setMonth(addMonths(month, 12))}
            >
              <ChevronIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTHS_SHORT.map((label, index) => {
              const active = index === month.getMonth();
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setMonth(new Date(month.getFullYear(), index, 1));
                    setPickingMonth(false);
                  }}
                  className={cn(
                    "h-9 rounded-lg text-sm transition-colors",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
                    active
                      ? "bg-gold-500 font-semibold text-navy-950"
                      : admin
                        ? "text-admin-foreground hover:bg-gold-50"
                        : "text-foreground hover:bg-gold-50",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="p-3">
          <div
            className={cn(
              "mb-1 grid grid-cols-7 gap-0.5 text-center text-[0.65rem] font-semibold tracking-wide",
              admin ? "text-admin-foreground/45" : "text-muted-foreground",
            )}
          >
            {WEEKDAYS.map((day) => (
              <span key={day} className="py-1">
                {day}
              </span>
            ))}
          </div>

          <div
            ref={gridRef}
            role="grid"
            tabIndex={0}
            onKeyDown={onGridKeyDown}
            className="grid grid-cols-7 gap-0.5 focus:outline-none"
          >
            {grid.map((day) => {
              const isOutside = day.getMonth() !== month.getMonth();
              const isSelected = selected ? sameDay(day, selected) : false;
              const isToday = sameDay(day, today);
              const isFocused = sameDay(day, focused);
              const isDisabled = outOfRange(day);
              return (
                <button
                  key={day.getTime()}
                  type="button"
                  role="gridcell"
                  tabIndex={-1}
                  disabled={isDisabled}
                  aria-selected={isSelected}
                  aria-current={isToday ? "date" : undefined}
                  onClick={() => select(day)}
                  className={cn(
                    "flex h-9 items-center justify-center rounded-lg text-sm tabular transition-colors",
                    "focus:outline-none",
                    isSelected
                      ? "bg-gold-500 font-semibold text-navy-950"
                      : isToday
                        ? "font-semibold text-gold-700 ring-1 ring-gold-400"
                        : isOutside
                          ? admin
                            ? "text-admin-foreground/25"
                            : "text-muted-foreground/45"
                          : admin
                            ? "text-admin-foreground"
                            : "text-foreground",
                    !isSelected && !isDisabled && "hover:bg-gold-50",
                    isFocused && !isSelected && "ring-2 ring-gold-500/50",
                    isDisabled && "cursor-not-allowed opacity-30 hover:bg-transparent",
                  )}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div
        className={cn(
          "flex items-center justify-between border-t px-3 py-2",
          admin ? "border-admin-border" : "border-border",
        )}
      >
        <button
          type="button"
          onClick={() => {
            commit("");
            closePicker();
          }}
          className={cn(
            "rounded-lg px-2 py-1 text-sm transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
            admin
              ? "text-admin-foreground/55 hover:text-admin-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Limpar
        </button>
        <button
          type="button"
          disabled={outOfRange(today)}
          onClick={() => select(today)}
          className={cn(
            "rounded-lg px-2 py-1 text-sm font-medium text-gold-600 transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
            "hover:text-gold-700 disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          Hoje
        </button>
      </div>
    </motion.div>
  );

  return (
    <div ref={rootRef} className="relative">
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
          "flex h-10 w-full items-center gap-2 rounded-md border px-3 text-left text-sm transition-colors",
          admin
            ? "border-admin-border bg-admin-background text-admin-foreground"
            : "border-border bg-background text-foreground",
          open && "border-gold-500 ring-2 ring-gold-500/25",
          invalid && "border-destructive",
          selected && !disabled && "pr-11",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          disabled={disabled}
          // Clicar no ícone é o mesmo que clicar no campo: abre o calendário
          // e leva o foco para lá, para digitar em seguida.
          onClick={() => {
            openPicker();
            triggerRef.current?.focus();
          }}
          className="flex-none text-gold-600 disabled:cursor-not-allowed"
        >
          <CalendarIcon className="h-4 w-4" />
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
            "min-w-0 flex-1 truncate bg-transparent tabular outline-none",
            admin ? "placeholder:text-admin-foreground/40" : "placeholder:text-muted-foreground",
            disabled && "cursor-not-allowed",
          )}
        />

        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label={open ? "Fechar calendário" : "Abrir calendário"}
          onClick={() => {
            if (open) {
              closePicker(false);
            } else {
              openPicker();
              triggerRef.current?.focus();
            }
          }}
          className="flex-none text-muted-foreground transition-transform disabled:cursor-not-allowed"
        >
          <ChevronIcon
            className={cn("h-4 w-4", open ? "-rotate-90" : "rotate-90")}
          />
        </button>
      </div>

      {/* Fora do gatilho: um <button> dentro de outro seria HTML inválido. */}
      {selected && !disabled && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Limpar data"
          onClick={() => commit("")}
          className={cn(
            "absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
            admin
              ? "text-admin-foreground/40 hover:bg-admin-muted hover:text-admin-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      )}

      {mounted &&
        createPortal(open ? popover : null, document.body)}
    </div>
  );
}
