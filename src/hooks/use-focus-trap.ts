"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Prende o Tab dentro de `ref` enquanto `active`, manda o foco inicial para
 * dentro (`[data-autofocus]` ou o primeiro focável) e o devolve a quem abriu.
 * Mesmo contrato do `Dialog`, para modais que montam o próprio contêiner.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const items = () => Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);

    (ref.current?.querySelector<HTMLElement>("[data-autofocus]") ?? items()[0])?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const list = items();
      const first = list[0];
      const last = list[list.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [ref, active]);
}
