"use client";

import dynamic from "next/dynamic";

/**
 * GSAP/ScrollTrigger só entram no bundle de quem realmente usa animação de
 * scroll (a landing page) — `ssr:false` evita hidratação SSR desnecessária
 * e mantém a árvore fora do bundle da área logada (§7.2).
 */
export const ScrollReveal = dynamic(
  () => import("@/components/motion/scroll-reveal").then((m) => m.ScrollReveal),
  { ssr: false },
);
