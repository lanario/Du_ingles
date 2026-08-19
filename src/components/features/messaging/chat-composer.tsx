"use client";

/**
 * Campo de escrita. Cresce com o texto até um teto e volta a encolher —
 * chat não é formulário, a caixa tem que acompanhar a frase.
 *
 * Enter envia, Shift+Enter quebra linha: a convenção que todo mundo já traz
 * de outros mensageiros. Em telas de toque o Enter só quebra linha (o teclado
 * virtual não oferece Shift), então o botão é o caminho.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import gsap from "gsap";
import { AnimatePresence, motion } from "framer-motion";
import { LockIcon, SendIcon, SpinnerIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

const MAX_LENGTH = 5000;
const MAX_ROWS_PX = 168;

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function ChatComposer({
  onSend,
  disabled,
  lockedReason,
  placeholder,
}: {
  onSend: (body: string) => Promise<{ ok: boolean; message?: string }>;
  disabled?: boolean;
  lockedReason?: string | null;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !sending && !disabled;

  // Altura acompanha o conteúdo: zera e relê `scrollHeight` a cada tecla —
  // é a única forma de a caixa *encolher* ao apagar texto.
  useIsomorphicLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_ROWS_PX)}px`;
  }, [value]);

  const submit = useCallback(async () => {
    const body = textareaRef.current?.value.trim() ?? "";
    if (!body || sending || disabled) return;

    setSending(true);
    setError(null);
    // Esvaziar antes da resposta: a bolha otimista já apareceu na thread, e
    // manter o texto no campo faria parecer que o envio falhou.
    setValue("");

    if (buttonRef.current) {
      gsap.fromTo(
        buttonRef.current,
        { scale: 0.86 },
        { scale: 1, duration: 0.45, ease: "elastic.out(1, 0.5)" },
      );
    }

    const result = await onSend(body);
    setSending(false);

    if (!result.ok) {
      setError(result.message ?? "Falha ao enviar.");
      // Devolve o texto para que a pessoa não perca o que escreveu.
      setValue(body);
    }

    textareaRef.current?.focus();
  }, [disabled, onSend, sending]);

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  }

  if (lockedReason) {
    return (
      <div className="shrink-0 border-t border-[var(--chat-border)] bg-[var(--chat-surface)] px-4 py-4">
        <p className="flex items-center justify-center gap-2 rounded-xl bg-[var(--chat-canvas)] px-4 py-3 text-center text-xs text-[var(--chat-muted-fg)]">
          <LockIcon className="h-4 w-4 shrink-0 text-warning" />
          {lockedReason}
        </p>
      </div>
    );
  }

  const remaining = MAX_LENGTH - value.length;

  return (
    <div className="shrink-0 border-t border-[var(--chat-border)] bg-[var(--chat-surface)] px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:px-5">
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-2 overflow-hidden text-xs text-destructive"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div
        className={cn(
          "flex items-end gap-2 rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-canvas)] p-1.5",
          "transition-shadow focus-within:ring-2 focus-within:ring-[var(--chat-accent)]",
        )}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          maxLength={MAX_LENGTH}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder ?? "Escreva para a turma…"}
          aria-label="Mensagem"
          className={cn(
            "max-h-42 min-h-10 flex-1 resize-none bg-transparent px-2.5 py-2 text-sm leading-relaxed",
            "text-[var(--chat-fg)] placeholder:text-[var(--chat-muted-fg)] focus:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        />

        <button
          ref={buttonRef}
          type="button"
          onClick={() => void submit()}
          disabled={!canSend}
          aria-label="Enviar mensagem"
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-all",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-accent)]",
            canSend
              ? "bg-[var(--chat-own)] text-[var(--chat-own-fg)] hover:opacity-90"
              : "bg-transparent text-[var(--chat-muted-fg)]",
          )}
        >
          {sending ? (
            <SpinnerIcon className="h-4.5 w-4.5 animate-spin" />
          ) : (
            <SendIcon className="h-4.5 w-4.5" />
          )}
        </button>
      </div>

      <div className="mt-1.5 flex items-center justify-between px-1">
        <p className="text-[10px] text-[var(--chat-muted-fg)]">
          <kbd className="font-sans font-medium">Enter</kbd> envia ·{" "}
          <kbd className="font-sans font-medium">Shift+Enter</kbd> quebra linha
        </p>
        {remaining < 400 && (
          <p
            className={cn(
              "text-[10px] tabular",
              remaining < 50 ? "text-destructive" : "text-[var(--chat-muted-fg)]",
            )}
          >
            {remaining}
          </p>
        )}
      </div>
    </div>
  );
}
