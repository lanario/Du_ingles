"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

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
 * layout thrashing e derruba o INP (§7.2). `matchMedia` desliga a animação
 * inteira quando o usuário pede `prefers-reduced-motion`.
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

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          reduceMotion: "(prefers-reduced-motion: reduce)",
          noPreference: "(prefers-reduced-motion: no-preference)",
        },
        (context) => {
          const { reduceMotion } = context.conditions as { reduceMotion: boolean };
          if (reduceMotion) return;

          const items = container.querySelectorAll(itemSelector);
          gsap.from(items.length ? items : container, {
            y,
            opacity: 0,
            duration: 0.6,
            stagger,
            ease: "power2.out",
            scrollTrigger: {
              trigger: container,
              start: "top 80%",
              once: true,
            },
          });
        },
      );
    }, container);

    return () => ctx.revert();
  }, [itemSelector, y, stagger]);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}
