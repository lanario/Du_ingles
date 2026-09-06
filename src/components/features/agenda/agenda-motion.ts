"use client";

/**
 * Movimento da agenda.
 *
 * A divisão entre as duas bibliotecas é a mesma do resto do painel
 * (`components/motion/list-motion.ts`), e existe para que elas não disputem o
 * mesmo `transform`:
 *
 * - **Framer Motion** cuida do que entra e sai (cartões, painéis, troca de
 *   vista) — está nos componentes.
 * - **GSAP + ScrollTrigger** cuidam do que depende da rolagem da grade, que
 *   aqui não é a da página: a agenda rola dentro do próprio quadro, então
 *   todo trigger precisa do `scroller` apontado para esse container. Sem
 *   isso o ScrollTrigger observa a janela, nada nunca "entra em cena", e as
 *   linhas ficam invisíveis para sempre.
 */

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Revela em cascata os filhos marcados com `[data-reveal]` conforme eles
 * sobem pela grade. `deps` remonta os triggers quando a vista ou o filtro
 * troca — os elementos observados deixaram de existir.
 */
export function useRevealOnScroll(
  scrollerRef: RefObject<HTMLElement | null>,
  deps: unknown[],
) {
  useIsomorphicLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const targets = Array.from(scroller.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (targets.length === 0) return;

    if (prefersReducedMotion()) {
      gsap.set(targets, { opacity: 1, y: 0 });
      return;
    }

    const context = gsap.context(() => {
      for (const target of targets) {
        gsap.fromTo(
          target,
          { opacity: 0, y: 14 },
          {
            opacity: 1,
            y: 0,
            duration: 0.45,
            ease: "power2.out",
            scrollTrigger: {
              trigger: target,
              scroller,
              // A grade é alta e a rolagem é curta: disparar bem cedo evita
              // que a linha só apareça depois de já estar visível.
              start: "top 96%",
              once: true,
            },
          },
        );
      }
    }, scroller);

    ScrollTrigger.refresh();
    return () => context.revert();
  }, [scrollerRef, ...deps]);
}

/**
 * Fio de progresso da rolagem, preso à barra de ferramentas. `scrub` de
 * verdade (via `onUpdate`): o traço acompanha o dedo, sem inércia.
 */
export function useScrollProgress(
  scrollerRef: RefObject<HTMLElement | null>,
  deps: unknown[],
) {
  const lineRef = useRef<HTMLSpanElement>(null);

  useIsomorphicLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const line = lineRef.current;
    if (!scroller || !line) return;

    gsap.set(line, { scaleX: 0, transformOrigin: "left center" });

    const update = () => {
      const total = scroller.scrollHeight - scroller.clientHeight;
      const progress = total > 8 ? scroller.scrollTop / total : 0;
      gsap.set(line, { scaleX: Math.min(1, Math.max(0, progress)) });
    };

    update();
    scroller.addEventListener("scroll", update, { passive: true });
    return () => scroller.removeEventListener("scroll", update);
  }, [scrollerRef, ...deps]);

  return lineRef;
}

/**
 * Leva a grade até a hora atual quando ela abre. Quem entra na agenda quer
 * ver "agora", não sete horas de madrugada vazia — e a rolagem animada
 * mostra que existe conteúdo acima, coisa que um salto seco esconde.
 */
export function useScrollToNow(
  scrollerRef: RefObject<HTMLElement | null>,
  offsetPx: number | null,
  deps: unknown[],
) {
  useIsomorphicLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || offsetPx === null) return;

    const target = Math.max(0, offsetPx - scroller.clientHeight / 3);
    if (prefersReducedMotion()) {
      scroller.scrollTop = target;
      return;
    }

    const tween = gsap.to(scroller, {
      scrollTop: target,
      duration: 0.7,
      ease: "power3.out",
    });
    return () => {
      tween.kill();
    };
  }, [scrollerRef, offsetPx, ...deps]);
}
