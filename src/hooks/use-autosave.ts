"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DEBOUNCE_MS = 2000;
const MAX_WAIT_MS = 15000;
const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 16000;

export type AutosaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

/**
 * Debounce de 2s ocioso / força salvar a cada 15s de digitação contínua.
 * Se o save falhar, mantém o payload e tenta de novo com backoff
 * exponencial — o pior cenário do produto é o professor perder conteúdo
 * de aula por causa de uma queda de internet (§8.3).
 */
export function useAutosave<T>(save: (value: T) => Promise<boolean>) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const pendingValue = useRef<T | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxWaitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttempt = useRef(0);
  const isSaving = useRef(false);

  const clearTimers = () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (maxWaitTimer.current) clearTimeout(maxWaitTimer.current);
  };

  const flush = useCallback(async () => {
    if (pendingValue.current === null || isSaving.current) return;
    clearTimers();

    const value = pendingValue.current;
    isSaving.current = true;
    setStatus("saving");

    try {
      const success = await save(value);
      isSaving.current = false;

      if (success) {
        pendingValue.current = null;
        retryAttempt.current = 0;
        setStatus("saved");
        setLastSavedAt(new Date());
        return;
      }
      throw new Error("save returned false");
    } catch {
      isSaving.current = false;
      setStatus("error");
      const delay = Math.min(RETRY_BASE_MS * 2 ** retryAttempt.current, RETRY_MAX_MS);
      retryAttempt.current += 1;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(flush, delay);
    }
  }, [save]);

  const schedule = useCallback(
    (value: T) => {
      pendingValue.current = value;
      setStatus("pending");

      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(flush, DEBOUNCE_MS);

      if (!maxWaitTimer.current) {
        maxWaitTimer.current = setTimeout(() => {
          maxWaitTimer.current = null;
          flush();
        }, MAX_WAIT_MS);
      }
    },
    [flush],
  );

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (pendingValue.current !== null) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      clearTimers();
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  return { status, lastSavedAt, schedule, flush };
}
