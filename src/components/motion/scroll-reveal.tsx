"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";

interface ScrollRevealProps {
  children: ReactNode;
  /** Seletor dos itens a animar em stagger dentro do container. */
  itemSelector?: string;
  className?: string;
  y?: number;
  stagger?: number;
}

/**
 * Only transform/opacity (GPU-only) — animar width/height/top/left causa
 * layout thrashing e derruba o INP (§7.2). `prefers-reduced-motion` desliga
 * a animação inteira e deixa o conteúdo visível.
 *
 * O gatilho é `IntersectionObserver`, não o ScrollTrigger: o ScrollTrigger
 * mede as posições no momento em que é criado e, como este componente entra
 * por `dynamic({ ssr: false })` (antes de fontes/shader/imagens acomodarem o
 * layout), essas medidas nasciam desatualizadas e o `onEnter` nunca
 * disparava — a seção ficava presa em `opacity: 0`. O observer é sempre
 * relativo à viewport real e emite um callback inicial, então o conteúdo ou
 * já aparece no mount ou aparece assim que entra na tela.
 */
export function ScrollReveal({
  children,
  itemSelector = ":scope > *",
  className,
  y = 32,
  stagger = 0.1,
}: ScrollRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const found = container.querySelectorAll<HTMLElement>(itemSelector);
    const targets: HTMLElement[] = found.length ? Array.from(found) : [container];

    gsap.set(targets, { y, opacity: 0 });

    let played = false;
    const play = () => {
      if (played) return;
      played = true;
      observer.disconnect();
      window.clearTimeout(failsafe);
      gsap.to(targets, {
        y: 0,
        opacity: 1,
        duration: 0.6,
        stagger,
        ease: "power2.out",
        // Sem props inline sobrando: o elemento volta ao estado do CSS.
        clearProps: "opacity,transform",
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) play();
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(container);

    // Rede de segurança: uma animação de entrada nunca pode ser o motivo de um
    // bloco ficar invisível. Se em 4s nada disparou o observer, revela assim
    // mesmo — o pior caso passa a ser perder o fade, não a seção inteira.
    const failsafe = window.setTimeout(play, 4000);

    return () => {
      observer.disconnect();
      window.clearTimeout(failsafe);
      gsap.killTweensOf(targets);
      gsap.set(targets, { clearProps: "opacity,transform" });
    };
  }, [itemSelector, y, stagger]);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}
