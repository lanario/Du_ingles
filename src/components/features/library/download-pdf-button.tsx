"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { getSessionPdfUrlAction } from "@/actions/shared/session-pdf";
import { DownloadIcon } from "@/components/ui/icons";

type State = "idle" | "loading" | "done" | "error";

const LABELS: Record<State, string> = {
  idle: "Baixar PDF",
  loading: "Gerando link…",
  done: "PDF liberado",
  error: "Tentar de novo",
};

/**
 * Piso do ciclo de carregamento. A signed URL costuma voltar em poucas
 * centenas de ms — sem esse piso o preenchimento do disco seria um flash e o
 * aluno não teria como saber que o clique surtiu efeito.
 */
const MIN_LOADING_MS = 1200;
/** Tempo em que a confirmação fica na tela antes de o botão voltar ao repouso. */
const DONE_MS = 2600;

export function DownloadPdfButton({
  sessionId,
  hasPdf,
}: {
  sessionId: string;
  hasPdf: boolean;
}) {
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const schedule = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  if (!hasPdf) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-dashed border-border px-3.5 py-2 text-xs font-medium text-muted-foreground">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold-400" />
        PDF em preparo
      </span>
    );
  }

  async function handleClick() {
    if (state === "loading") return;

    setError(null);
    setState("loading");
    const startedAt = Date.now();

    const result = await getSessionPdfUrlAction(sessionId);
    const remaining = Math.max(0, MIN_LOADING_MS - (Date.now() - startedAt));

    schedule(() => {
      if (!result.success) {
        setError(result.error.message);
        setState("error");
        schedule(() => setState("idle"), DONE_MS);
        return;
      }
      window.open(result.data, "_blank", "noopener,noreferrer");
      setState("done");
      schedule(() => setState("idle"), DONE_MS);
    }, remaining);
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        data-state={state}
        disabled={state === "loading"}
        onClick={handleClick}
        aria-live="polite"
        aria-label={state === "idle" ? "Baixar PDF da aula" : LABELS[state]}
        // O preenchimento do disco dura exatamente o ciclo mínimo: o botão
        // termina de encher no mesmo instante em que o estado vira "done".
        style={{ "--dl-duration": `${MIN_LOADING_MS}ms` } as CSSProperties}
        className="dl-btn"
      >
        <span className="dl-btn__circle">
          <DownloadIcon className="dl-btn__icon" />
          <span className="dl-btn__square" aria-hidden="true" />
        </span>
        <span className="dl-btn__label">{LABELS[state]}</span>
      </button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
