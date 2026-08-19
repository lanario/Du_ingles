"use client";

/**
 * Seletor da plataforma. Substitui o `<select>` nativo — cujo menu é
 * desenhado pelo SO e foge da paleta — por um listbox nosso, na mesma
 * anatomia do `DateField`: gatilho com o visual dos outros campos, painel em
 * portal (painéis/diálogos rolam e cortariam um dropdown posicionado dentro
 * deles) e valor enviado por um input escondido, então Server Actions
 * continuam lendo `formData.get(name)` como antes.
 *
 * A API aceita `<option>` como filhos, como o `<select>` nativo, para que os
 * pontos de uso não precisem mudar a forma como declaram as opções.
 */

import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type OptionHTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckIcon, ChevronIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export type SelectTone = "app" | "admin";

interface SelectOptionData {
  value: string;
  label: ReactNode;
  disabled: boolean;
}

export interface SelectProps {
  id?: string;
  name?: string;
  /** Controlado. */
  value?: string;
  /** Não controlado. */
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** `<option>` — mesma API do `<select>` nativo. */
  children?: ReactNode;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  /** Paleta do chrome onde o campo vive. */
  tone?: SelectTone;
  invalid?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
}

function extractOptions(children: ReactNode): SelectOptionData[] {
  const options: SelectOptionData[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child) || child.type !== "option") return;
    const props = child.props as OptionHTMLAttributes<HTMLOptionElement>;
    options.push({
      value: String(props.value ?? ""),
      label: props.children,
      disabled: props.disabled ?? false,
    });
  });
  return options;
}

/** Próxima opção habilitada a partir de `from`, andando em `dir`. */
function nextEnabled(options: SelectOptionData[], from: number, dir: 1 | -1): number {
  if (options.length === 0) return 0;
  let index = from;
  for (let step = 0; step < options.length; step++) {
    index = (index + dir + options.length) % options.length;
    if (!options[index]?.disabled) return index;
  }
  return Math.min(Math.max(from, 0), options.length - 1);
}

export function Select({
  id,
  name,
  value,
  defaultValue,
  onChange,
  children,
  placeholder = "Selecione…",
  disabled = false,
  required = false,
  tone = "app",
  invalid = false,
  className,
  "aria-label": ariaLabel,
  "aria-describedby": describedBy,
}: SelectProps) {
  const options = useMemo(() => extractOptions(children), [children]);
  const controlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? "");
  const current = controlled ? (value ?? "") : internal;

  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );
  const [mounted, setMounted] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();
  const admin = tone === "admin";
  const listboxId = useId();

  useEffect(() => setMounted(true), []);

  const selectedIndex = options.findIndex((option) => option.value === current);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const commit = useCallback(
    (next: string) => {
      // Escreve no DOM antes do próximo render — um `onChange` que dispara
      // `form.requestSubmit()` de imediato (ex.: filtro que já recarrega a
      // lista) precisa ver o valor novo no input escondido nessa mesma volta.
      if (hiddenRef.current) hiddenRef.current.value = next;
      if (!controlled) setInternal(next);
      onChange?.(next);
    },
    [controlled, onChange],
  );

  const place = useCallback(() => {
    const trigger = triggerRef.current;
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

  const openList = useCallback(() => {
    if (disabled || options.length === 0) return;
    setHighlighted(selectedIndex >= 0 ? selectedIndex : nextEnabled(options, -1, 1));
    setOpen(true);
  }, [disabled, options, selectedIndex]);

  const closeList = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
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

  // Foca a lista ao abrir para as setas funcionarem de imediato.
  useEffect(() => {
    if (open) listRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${highlighted}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, highlighted]);

  function selectOption(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    commit(option.value);
    closeList();
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled || open) return;
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      openList();
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setHighlighted((i) => nextEnabled(options, i, 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setHighlighted((i) => nextEnabled(options, i, -1));
        break;
      case "Home":
        event.preventDefault();
        setHighlighted(nextEnabled(options, -1, 1));
        break;
      case "End":
        event.preventDefault();
        setHighlighted(nextEnabled(options, options.length, -1));
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        selectOption(highlighted);
        break;
      case "Escape":
        event.preventDefault();
        closeList();
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  const popover = (
    <motion.div
      ref={popoverRef}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
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
        id={listboxId}
        tabIndex={-1}
        aria-activedescendant={options.length > 0 ? `${listboxId}-opt-${highlighted}` : undefined}
        onKeyDown={onListKeyDown}
        className="max-h-64 overflow-y-auto p-1.5 focus:outline-none"
      >
        {options.map((option, index) => {
          const active = index === highlighted;
          const selected = option.value === current;
          return (
            <li
              key={`${option.value}-${index}`}
              id={`${listboxId}-opt-${index}`}
              data-index={index}
              role="option"
              aria-selected={selected}
              aria-disabled={option.disabled || undefined}
              onMouseEnter={() => !option.disabled && setHighlighted(index)}
              onClick={() => selectOption(index)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
                option.disabled
                  ? "cursor-not-allowed opacity-40"
                  : "cursor-pointer",
                !option.disabled && active && (admin ? "bg-admin-muted" : "bg-gold-50"),
                selected
                  ? admin
                    ? "font-semibold text-admin-foreground"
                    : "font-semibold text-navy-900"
                  : admin
                    ? "text-admin-foreground/80"
                    : "text-foreground",
              )}
            >
              <span className="flex-1 truncate">{option.label}</span>
              {selected && <CheckIcon className="h-3.5 w-3.5 flex-none text-gold-600" />}
            </li>
          );
        })}
      </ul>
    </motion.div>
  );

  return (
    <div ref={rootRef} className="relative">
      {name && <input ref={hiddenRef} type="hidden" name={name} value={current} readOnly />}

      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled || options.length === 0}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-required={required || undefined}
        aria-invalid={invalid || undefined}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        onClick={() => (open ? closeList(false) : openList())}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-xl border px-3 text-left text-sm transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
          admin
            ? "border-admin-border bg-admin-background text-admin-foreground hover:border-gold-300"
            : "border-border bg-background text-foreground hover:border-gold-300",
          open && "border-gold-500 ring-2 ring-gold-500/25",
          invalid && "border-destructive",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        <span
          className={cn(
            "flex-1 truncate",
            !selectedOption && (admin ? "text-admin-foreground/45" : "text-muted-foreground"),
          )}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronIcon
          className={cn(
            "h-4 w-4 flex-none transition-transform",
            admin ? "text-admin-foreground/40" : "text-muted-foreground",
            open ? "-rotate-90" : "rotate-90",
          )}
        />
      </button>

      {mounted &&
        createPortal(<AnimatePresence>{open && popover}</AnimatePresence>, document.body)}
    </div>
  );
}
