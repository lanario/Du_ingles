"use client";

/**
 * Movimento da agenda.
 *
 * A divisão entre as duas bibliotecas é a mesma do resto do painel
 * (`components/motion/list-motion.ts`), e aqui ela não é estilo: é o que
 * impede as duas de brigarem pelo mesmo `opacity`/`transform`.
 *
 * - **Framer Motion** anima o que entra e sai — cartões, células do mês,
 *   linhas da lista, painéis. É a única biblioteca que escreve opacidade de
 *   conteúdo.
 * - **GSAP + ScrollTrigger** cuidam do que depende da rolagem da grade, que
 *   não é a da página: a agenda rola dentro do próprio quadro, então todo
 *   trigger precisa do `scroller` apontado para esse container.
 *
 * Uma versão anterior revelava as células do mês com `ScrollTrigger` +
 * `fromTo(opacity: 0)` enquanto o Framer animava as mesmas células. Onde o
 * trigger não disparava (o mês cabe na tela e quase não rola), o GSAP deixava
 * o `opacity: 0` inline e metade do mês simplesmente não aparecia. Por isso
 * nada aqui escreve opacidade de conteúdo — o GSAP só mexe no fio de
 * progresso e na posição de rolagem.
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
 * Fio de progresso sob a barra de ferramentas, amarrado à rolagem da grade.
 * `onUpdate` em vez de `scrub`: o traço acompanha o dedo, sem inércia.
 *
 * Se o trigger não conseguir se instalar, o pior que acontece é o fio ficar
 * parado — nenhum conteúdo depende dele para estar visível.
 */
export function useScrollProgress(
  scrollerRef: RefObject<HTMLElement | null>,
  key: string,
) {
  const lineRef = useRef<HTMLSpanElement>(null);

  useIsomorphicLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const line = lineRef.current;
    if (!scroller || !line) return;

    const content = scroller.firstElementChild;
    gsap.set(line, { scaleX: 0, transformOrigin: "left center" });

    const draw = (progress: number) =>
      gsap.set(line, { scaleX: Math.min(1, Math.max(0, progress)) });

    if (!content) return;

    const trigger = ScrollTrigger.create({
      scroller,
      trigger: content as HTMLElement,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => draw(self.progress),
    });

    // A troca de vista muda a altura do conteúdo; sem o refresh o trigger
    // continuaria medindo a vista anterior.
    ScrollTrigger.refresh();

    return () => trigger.kill();
  }, [scrollerRef, key]);

  return lineRef;
}

/**
 * Leva a grade até a hora atual quando ela abre. Quem entra na agenda quer
 * ver "agora", não sete horas de madrugada vazia.
 *
 * Roda **uma vez por vista/dia** (`key`), e não a cada render: como tween de
 * rolagem, repetir significa arrancar a grade da mão de quem já estava
 * rolando. E se o alvo é o topo — de madrugada, com "agora" antes do começo
 * da grade — não há nada para animar.
 */
export function useScrollToNow(
  scrollerRef: RefObject<HTMLElement | null>,
  offsetPx: number | null,
  key: string,
) {
  const doneFor = useRef<string | null>(null);

  useIsomorphicLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || offsetPx === null) return;
    if (doneFor.current === key) return;
    doneFor.current = key;

    const target = Math.max(0, offsetPx - scroller.clientHeight / 3);
    if (target < 1) return;

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
  }, [scrollerRef, offsetPx, key]);
}
