"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { Dialog } from "@/components/ui/dialog";
import { FormBanner } from "@/components/ui/form-message";
import { TrashIcon } from "@/components/ui/icons";

interface ConfirmDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  /** Chamado com o texto digitado; devolve a mensagem de erro, ou `null` se deu certo. */
  onConfirm: (typed: string) => Promise<string | null>;
  title: string;
  description: string;
  /** Texto que a pessoa precisa digitar para liberar o botão. */
  confirmationText: string;
  confirmLabel?: string;
}

/**
 * Confirmação de exclusão. Divisão de libs igual ao resto do sistema:
 *  - Framer Motion → entrada/saída do modal (via `Dialog`)
 *  - GSAP → coreografia interna: ícone, cascata do conteúdo e o "tremor" do
 *    botão quando a confirmação falha
 */
export function ConfirmDeleteDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmationText,
  confirmLabel = "Excluir definitivamente",
}: ConfirmDeleteDialogProps) {
  // Escape e clique no fundo também fecham o `Dialog`; durante a exclusão isso
  // esconderia um eventual erro, então o fechamento fica travado até terminar.
  const busyRef = useRef(false);
  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!busyRef.current) onClose();
      }}
      title={title}
      layer="overlay"
    >
      <ConfirmBody
        description={description}
        confirmationText={confirmationText}
        confirmLabel={confirmLabel}
        busyRef={busyRef}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    </Dialog>
  );
}

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

function ConfirmBody({
  description,
  confirmationText,
  confirmLabel,
  busyRef,
  onClose,
  onConfirm,
}: Pick<ConfirmDeleteDialogProps, "description" | "confirmationText" | "onClose" | "onConfirm"> & {
  confirmLabel: string;
  busyRef: { current: boolean };
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const matches = confirmationText.trim() !== "" && normalize(typed) === normalize(confirmationText);

  useLayoutEffect(() => {
    if (reduceMotion || !rootRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-step]", {
        opacity: 0,
        y: 12,
        duration: 0.4,
        ease: "power3.out",
        stagger: 0.07,
        delay: 0.08,
      });
      gsap.fromTo(
        "[data-icon]",
        { scale: 0.5, rotate: -12, opacity: 0 },
        { scale: 1, rotate: 0, opacity: 1, duration: 0.55, ease: "back.out(2.2)" },
      );
      gsap.to("[data-icon-ring]", {
        scale: 1.45,
        opacity: 0,
        duration: 1.6,
        ease: "power1.out",
        repeat: -1,
      });
    }, rootRef);
    return () => ctx.revert();
  }, [reduceMotion]);

  function shake() {
    if (reduceMotion || !confirmRef.current) return;
    gsap.to(confirmRef.current, {
      keyframes: { x: [-8, 8, -6, 6, -3, 3, 0], easeEach: "power2.out" },
      duration: 0.45,
    });
  }

  async function submit() {
    if (busy) return;
    if (!matches) {
      setError(`Digite “${confirmationText}” para confirmar.`);
      shake();
      return;
    }
    setBusy(true);
    busyRef.current = true;
    setError(null);
    const message = await onConfirm(typed);
    if (message) {
      setError(message);
      setBusy(false);
      busyRef.current = false;
      shake();
      inputRef.current?.focus();
    } else {
      busyRef.current = false;
    }
    // Sucesso: o pai fecha o diálogo; o estado morre com a desmontagem.
  }

  return (
    <div
      ref={rootRef}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
          event.preventDefault();
          void submit();
        }
      }}
    >
      <div data-step className="flex items-start gap-4">
        <div className="relative mt-0.5 h-11 w-11 shrink-0">
          <span
            data-icon-ring
            aria-hidden
            className="absolute inset-0 rounded-full bg-destructive/25"
          />
          <span
            data-icon
            className="relative flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive"
          >
            <TrashIcon className="h-5 w-5" />
          </span>
        </div>
        <p className="text-sm leading-relaxed text-foreground/80">{description}</p>
      </div>

      <label data-step className="mt-5 block text-sm text-foreground">
        Para confirmar, digite{" "}
        <span className="font-semibold text-destructive">{confirmationText}</span>
        <input
          ref={inputRef}
          data-autofocus
          type="text"
          value={typed}
          onChange={(event) => {
            setTyped(event.target.value);
            if (error) setError(null);
          }}
          autoComplete="off"
          spellCheck={false}
          readOnly={busy}
          aria-invalid={Boolean(error)}
          className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-destructive focus-visible:ring-2 focus-visible:ring-destructive/30 disabled:opacity-60"
        />
      </label>

      {error && (
        <div data-step className="mt-3">
          <FormBanner tone="error">{error}</FormBanner>
        </div>
      )}

      <div data-step className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          ref={confirmRef}
          type="button"
          onClick={() => void submit()}
          disabled={busy || !matches}
          className="rounded-xl bg-destructive px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Excluindo…" : confirmLabel}
        </button>
      </div>
    </div>
  );
}
