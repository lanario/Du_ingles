"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Card com borda iluminada por um holofote que segue o ponteiro. A luz é
 * única para a página toda: em vez de um listener por card, um só assinante
 * escreve `--glow-x`/`--glow-y` em `:root` e os gradientes — todos com
 * `background-attachment: fixed` — leem a mesma coordenada de viewport. É o
 * que faz a luz *atravessar* a fileira de cards em vez de acender cada um
 * por conta própria.
 *
 * As regras estáticas (`[data-glow-card]`, máscara da borda, halo) vivem em
 * `globals.css`, junto dos demais efeitos da landing; aqui ficam apenas os
 * tokens de cor e medida de cada instância.
 */

export type GlowTone = "gold" | "navy";

type ToneTokens = {
  /** Cor do feixe que corre pela borda. */
  spot: string;
  /** Núcleo quente dentro do feixe. */
  core: string;
  /** Borda em repouso, onde a luz não alcança. */
  idle: string;
};

const TONE_MAP: Record<GlowTone, ToneTokens> = {
  gold: {
    spot: "var(--gold-500)",
    core: "var(--gold-300)",
    idle: "color-mix(in srgb, var(--gold-500) 28%, transparent)",
  },
  navy: {
    spot: "var(--navy-600)",
    core: "var(--navy-300)",
    idle: "color-mix(in srgb, var(--navy-600) 24%, transparent)",
  },
};

const SIZE_MAP = {
  sm: "w-48 h-64",
  md: "w-64 h-80",
  lg: "w-80 h-96",
} as const;

/**
 * `soft` é o repouso da seção; `strong` marca o card em destaque com borda
 * mais grossa, véu interno mais presente e halo mais aberto.
 */
const INTENSITY_MAP = {
  soft: { border: "2", wash: "10%", outer: "0.45" },
  strong: { border: "2", wash: "18%", outer: "0.8" },
} as const;

let pointerSubscribers = 0;
let releasePointer: (() => void) | null = null;

/**
 * Assinatura compartilhada do ponteiro. O `requestAnimationFrame` garante no
 * máximo uma escrita de estilo por quadro, mesmo com o mouse em movimento
 * rápido — sem isso, `pointermove` dispara bem mais vezes do que a tela
 * consegue pintar.
 */
function subscribeToPointer(): () => void {
  pointerSubscribers += 1;

  if (!releasePointer) {
    const root = document.documentElement;
    let frame = 0;
    let lastX = 0;
    let lastY = 0;

    const paint = () => {
      frame = 0;
      root.style.setProperty("--glow-x", `${lastX}px`);
      root.style.setProperty("--glow-y", `${lastY}px`);
    };

    const sync = (event: PointerEvent) => {
      lastX = event.clientX;
      lastY = event.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    };

    document.addEventListener("pointermove", sync, { passive: true });

    releasePointer = () => {
      document.removeEventListener("pointermove", sync);
      if (frame) cancelAnimationFrame(frame);
      root.style.removeProperty("--glow-x");
      root.style.removeProperty("--glow-y");
    };
  }

  return () => {
    pointerSubscribers -= 1;
    if (pointerSubscribers === 0 && releasePointer) {
      releasePointer();
      releasePointer = null;
    }
  };
}

export type GlowCardProps = {
  children: ReactNode;
  className?: string;
  tone?: GlowTone;
  intensity?: "soft" | "strong";
  size?: keyof typeof SIZE_MAP;
  width?: string | number;
  height?: string | number;
  /** Ignora `size` e deixa a medida por conta de `className`/`width`/`height`. */
  customSize?: boolean;
};

export function GlowCard({
  children,
  className,
  tone = "gold",
  intensity = "soft",
  size = "md",
  width,
  height,
  customSize = false,
}: GlowCardProps) {
  useEffect(() => {
    // Quem pediu menos movimento fica com a luz parada no centro da tela
    // (o valor padrão de `--glow-x`/`--glow-y` em `globals.css`).
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    return subscribeToPointer();
  }, []);

  const { spot, core, idle } = TONE_MAP[tone];
  const { border, wash, outer } = INTENSITY_MAP[intensity];

  const style = {
    "--glow-spot": spot,
    "--glow-core": core,
    "--glow-idle": idle,
    "--glow-surface": "color-mix(in srgb, var(--background) 88%, transparent)",
    "--glow-radius": "16",
    "--glow-border": border,
    "--glow-size": "260",
    "--glow-wash": wash,
    "--glow-outer": outer,
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
  } as CSSProperties;

  return (
    <div
      data-glow-card
      style={style}
      className={cn(
        "relative backdrop-blur-[6px]",
        !customSize && SIZE_MAP[size],
        className,
      )}
    >
      <span data-glow-bloom aria-hidden="true" />
      {children}
    </div>
  );
}
