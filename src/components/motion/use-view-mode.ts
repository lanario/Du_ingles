"use client";

/**
 * Preferência de visualização (cartões/lista) persistida no localStorage —
 * uma fonte externa ao React, daí o `useSyncExternalStore`. O servidor
 * sempre renderiza "cards" e o cliente corrige na hidratação, sem
 * divergência de HTML e sem `setState` dentro de efeito.
 */

import { useSyncExternalStore } from "react";

export type ViewMode = "cards" | "list";

const listeners = new Set<() => void>();

function subscribe(onChange: () => void, key: string) {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === key) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function useViewMode(storageKey: string): [ViewMode, (mode: ViewMode) => void] {
  const mode = useSyncExternalStore(
    (onChange) => subscribe(onChange, storageKey),
    () => (window.localStorage.getItem(storageKey) === "list" ? "list" : "cards"),
    () => "cards" as ViewMode,
  );

  function setMode(next: ViewMode) {
    window.localStorage.setItem(storageKey, next);
    // `storage` só dispara em outras abas; esta aqui avisamos na mão.
    listeners.forEach((onChange) => onChange());
  }

  return [mode, setMode];
}

/**
 * Abaixo de 640px a grade de colunas fixas da lista não cabe — as células se
 * espremem até o texto virar uma coluna de letras. Nessa faixa a tela cai
 * para cartões sem tocar na preferência salva: ao voltar para uma tela
 * larga, a escolha do usuário continua valendo.
 */
export function useNarrowScreen(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia("(max-width: 639px)");
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(max-width: 639px)").matches,
    () => false,
  );
}
