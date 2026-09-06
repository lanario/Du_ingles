"use client";

/**
 * Link da gravação, no painel da aula encerrada.
 *
 * O Google Meet grava no Drive de quem conduziu a aula — a plataforma não vê
 * esse arquivo. Enquanto a integração com o Drive não existir, o caminho
 * curto é o professor colar aqui o link que o Meet gerou; o aluno que faltou
 * passa a ter como assistir pela biblioteca da turma, que é o que a gravação
 * precisa resolver.
 *
 * Mora só no "depois" (`AfterLesson`) porque é quando o link existe: o Meet
 * leva alguns minutos processando o vídeo depois que a chamada acaba.
 */

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { saveSessionRecordingAction } from "@/actions/admin/lesson-planner";
import { CheckIcon, PlayIcon, TrashIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { LogoLoader } from "@/components/ui/logo-loader";

export function RecordingPanel({
  sessionId,
  initialUrl,
  readOnly = false,
}: {
  sessionId: string;
  initialUrl: string | null;
  readOnly?: boolean;
}) {
  /** O que está gravado no banco — só muda quando o servidor confirma. */
  const [saved, setSaved] = useState(initialUrl);
  /** O que está no campo — pode divergir de `saved` enquanto o professor digita. */
  const [draft, setDraft] = useState(initialUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const dirty = draft.trim() !== (saved ?? "");

  function submit(value: string) {
    setError(null);
    startTransition(async () => {
      const result = await saveSessionRecordingAction(sessionId, value);
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      setSaved(result.data.recordingUrl);
      setDraft(result.data.recordingUrl ?? "");
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 2600);
    });
  }

  return (
    <section className="rounded-2xl border border-admin-border bg-admin-surface p-4">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-admin-foreground/55">
        Gravação
      </h2>

      {saved ? (
        <a
          href={saved}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center gap-2 rounded-xl border border-admin-border bg-admin-background px-3 py-2.5 text-sm font-medium text-admin-foreground transition-colors hover:border-gold-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
        >
          <PlayIcon className="h-4 w-4 shrink-0 text-gold-600" />
          Abrir a gravação
        </a>
      ) : (
        <p className="mt-1 text-[11px] leading-relaxed text-admin-foreground/50">
          Cole o link que o Google Meet gerou. Ele aparece na biblioteca da turma —
          quem faltou assiste por lá.
        </p>
      )}

      {!readOnly && (
        <>
          <label htmlFor={`recording-${sessionId}`} className="sr-only">
            Link da gravação
          </label>
          <input
            id={`recording-${sessionId}`}
            type="url"
            inputMode="url"
            value={draft}
            disabled={isPending}
            onChange={(event) => {
              setDraft(event.target.value);
              setError(null);
            }}
            placeholder="https://drive.google.com/…"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `recording-${sessionId}-error` : undefined}
            className={cn(
              "mt-3 w-full rounded-xl border bg-admin-background px-3 py-2 text-sm",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
              "disabled:opacity-60",
              error ? "border-destructive" : "border-admin-border",
            )}
          />

          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => submit(draft.trim())}
              disabled={isPending || !dirty}
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-navy-800 px-3 text-[13px] font-semibold text-white transition-colors hover:bg-navy-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 disabled:opacity-40"
            >
              {isPending ? <LogoLoader className="h-4 w-4" /> : "Salvar link"}
            </button>

            {/* Só some depois que o link está de fato gravado: remover é uma
                ação sobre o que o aluno já enxerga, não sobre o rascunho. */}
            {saved && (
              <button
                type="button"
                onClick={() => submit("")}
                disabled={isPending}
                aria-label="Remover a gravação"
                title="Remover a gravação"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-admin-border text-admin-foreground/60 transition-colors hover:border-destructive hover:text-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 disabled:opacity-40"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </>
      )}

      <AnimatePresence initial={false} mode="wait">
        {error && (
          <motion.p
            key="error"
            id={`recording-${sessionId}-error`}
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-2 text-[11px] leading-relaxed text-destructive"
          >
            {error}
          </motion.p>
        )}
        {!error && justSaved && (
          <motion.p
            key="saved"
            role="status"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--success)]"
          >
            <CheckIcon className="h-3.5 w-3.5" />
            {saved ? "Gravação publicada para a turma." : "Gravação removida."}
          </motion.p>
        )}
      </AnimatePresence>
    </section>
  );
}
