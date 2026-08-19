"use client";

/**
 * Movimento compartilhado pelas telas de listagem em cartões (usuários, e o
 * que vier depois).
 *
 * A divisão entre as duas bibliotecas é a mesma do resto do painel
 * (`scroll-reveal.tsx`) e evita que elas disputem o mesmo `transform`:
 *
 * - Framer Motion cuida dos cartões (entrada, saída, layout, hover).
 * - GSAP cuida do que depende da rolagem: a barra que gruda no topo e o fio
 *   de progresso da lista.
 */

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Altura do header fixo do admin — onde a barra de ferramentas encosta. */
const ALTURA_HEADER = 64;

/**
 * Marca a barra com `data-stuck` assim que ela encosta no header. Troca de
 * atributo, não de estilo inline: o visual fica no Tailwind
 * (`data-[stuck=true]:...`) e o React não re-renderiza por causa da rolagem.
 */
export function useStickyBar<T extends HTMLElement>() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<T>(null);

  useIsomorphicLayoutEffect(() => {
    const sentinel = sentinelRef.current;
    const bar = barRef.current;
    if (!sentinel || !bar) return;

    const trigger = ScrollTrigger.create({
      trigger: sentinel,
      start: `top ${ALTURA_HEADER}px`,
      end: "max",
      onToggle: (self) => {
        bar.dataset.stuck = String(self.isActive);
      },
    });

    return () => trigger.kill();
  }, []);

  return { sentinelRef, barRef };
}

/**
 * Fio dourado sob a barra: cresce conforme a lista passa pela tela. `scrub`
 * (aqui via `onUpdate`) amarra o progresso direto à rolagem, sem inércia.
 */
export function useListProgress(listRef: RefObject<HTMLElement | null>) {
  const lineRef = useRef<HTMLSpanElement>(null);

  useIsomorphicLayoutEffect(() => {
    const line = lineRef.current;
    const list = listRef.current;
    if (!line || !list) return;

    if (prefersReducedMotion()) {
      gsap.set(line, { scaleX: 0 });
      return;
    }

    gsap.set(line, { scaleX: 0, transformOrigin: "left center" });

    const trigger = ScrollTrigger.create({
      trigger: list,
      start: "top 70%",
      end: "bottom bottom",
      onUpdate: (self) => gsap.set(line, { scaleX: self.progress }),
    });

    return () => {
      trigger.kill();
      gsap.killTweensOf(line);
    };
  }, [listRef]);

  return lineRef;
}
