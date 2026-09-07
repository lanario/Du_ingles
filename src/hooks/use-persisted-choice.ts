"use client";

import { useLayoutEffect, useRef, useState } from "react";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined"
    ? useLayoutEffect
    : ((() => {}) as typeof useLayoutEffect);

/**
 * "Onde a pessoa parou" — a aba, a pasta, o filtro que estava aberto numa
 * tela com abas. Sem isso, toda vez que a tela remonta (clicou em outro item
 * do menu e voltou, deu F5, fechou e reabriu o navegador) o `useState`
 * reinicia no primeiro item, e quem vive na aba "Tarefas" reaprende a
 * clicar nela em toda visita.
 *
 * `explicitValue` é para quando outra fonte manda mais que a lembrança — um
 * link com `?tab=agenda`, ou um chat aberto por `?c=`. Presente, ele decide
 * a abertura E vira a nova lembrança; ausente, o hook lê o `localStorage`.
 *
 * A restauração roda em `useLayoutEffect` (antes da pintura), não em
 * `useEffect`: o primeiro render do cliente tem que bater com o do servidor
 * (que não conhece o `localStorage`) para não disparar aviso de hidratação,
 * e a troca para o valor lembrado tem que acontecer antes da tela pintar —
 * senão a aba padrão pisca por um quadro antes de virar a certa.
 */
export function usePersistedChoice<T extends string>(
  storageKey: string,
  /** Do valor bruto do storage (ou `null`) para um `T` sempre válido. */
  normalize: (raw: string | null) => T,
  explicitValue?: T,
): [T, (value: T) => void] {
  const [value, setValueState] = useState<T>(() => explicitValue ?? normalize(null));
  const restored = useRef(false);

  useIsomorphicLayoutEffect(() => {
    if (restored.current) return;
    restored.current = true;

    if (explicitValue !== undefined) {
      // A URL (ou outra prop explícita) já decidiu; ela também passa a ser
      // o que a próxima visita sem essa pista vai lembrar.
      try {
        window.localStorage.setItem(storageKey, explicitValue);
      } catch {
        // Modo privado ou cota cheia: a escolha explícita já valeu, só não
        // sobrevive à próxima visita.
      }
      return;
    }

    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(storageKey);
    } catch {
      // Sem storage — a tela segue no padrão, como se nunca tivesse memória.
    }

    const restoredValue = normalize(stored);
    setValueState((current) => (current === restoredValue ? current : restoredValue));
  }, []);

  function setValue(next: T) {
    setValueState(next);
    try {
      window.localStorage.setItem(storageKey, next);
    } catch {
      // Sem persistência, mas a troca em si funciona normalmente.
    }
  }

  return [value, setValue];
}
