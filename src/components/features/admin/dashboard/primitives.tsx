"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Divisão de responsabilidades entre as duas libs de animação do painel:
 * Framer Motion cuida do ciclo de vida do React (entrada dos cards, hover,
 * layout), GSAP + ScrollTrigger cuidam do que é imperativo e contínuo
 * (count-up de métrica, desenho de path, barra de progresso com scrub).
 * Misturar as duas no mesmo elemento causa disputa pela mesma propriedade —
 * por isso nenhum nó abaixo é animado pelas duas ao mesmo tempo.
 */

export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Respeita `prefers-reduced-motion` fora do React (para os tweens do GSAP). */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

interface CountUpProps {
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
}

/**
 * O valor final já vem no HTML do servidor — o tween só reescreve o
 * `textContent` depois da hidratação. Assim não há flash de "0" nem
 * mismatch de hidratação, e sem JS o número continua correto.
 */
export function CountUp({
  value,
  decimals = 0,
  suffix = "",
  prefix = "",
  duration = 1.4,
  className,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    const state = { current: 0 };
    const tween = gsap.to(state, {
      current: value,
      duration,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = `${prefix}${formatNumber(state.current, decimals)}${suffix}`;
      },
      scrollTrigger: { trigger: el, start: "top 92%", once: true },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [value, decimals, suffix, prefix, duration]);

  return (
    <span ref={ref} className={cn("tabular", className)}>
      {`${prefix}${formatNumber(value, decimals)}${suffix}`}
    </span>
  );
}

/**
 * Barra fina no topo da página, ligada ao progresso do scroll via
 * ScrollTrigger com `scrub` — dá ao admin uma noção de quanto ainda falta
 * de painel abaixo da dobra.
 */
export function ScrollProgressBar() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: "none",
          scrollTrigger: {
            trigger: document.documentElement,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.3,
          },
        },
      );
    });

    return () => ctx.revert();
  }, []);

  return (
    <div className="pointer-events-none sticky top-0 z-20 -mx-6 -mt-6 mb-6 h-0.5 bg-admin-border/60">
      <div
        ref={ref}
        className="h-full origin-left scale-x-0 bg-gradient-to-r from-navy-800 via-navy-600 to-gold-500"
      />
    </div>
  );
}

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  /** Deslocamento inicial no eixo Y, em px. */
  y?: number;
}

/** Entrada individual — usada por seções que não fazem parte de um grid. */
export function Reveal({ children, className, delay = 0, y = 24 }: RevealProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Container que escalona a entrada dos filhos diretos (`RevealItem`). */
export function RevealGrid({
  children,
  className,
  stagger = 0.07,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduced ? false : "hidden"}
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      variants={{ visible: { transition: { staggerChildren: stagger } } }}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

/** Tooltip flutuante dos gráficos — mesma casca visual em todos eles. */
export function ChartTooltip({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={style}
      className={cn(
        "pointer-events-none z-20 rounded-lg border border-admin-border bg-white/95 px-3 py-2 shadow-lg backdrop-blur",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Cartão base do painel: superfície branca, borda fria, elevação no hover. */
export function Card({
  children,
  className,
  interactive = true,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      whileHover={interactive && !reduced ? { y: -3 } : undefined}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className={cn(
        "group/card relative overflow-hidden rounded-2xl border border-admin-border bg-admin-surface",
        "shadow-[0_1px_2px_rgba(11,26,51,0.04),0_10px_30px_-18px_rgba(11,26,51,0.35)]",
        interactive &&
          "transition-[box-shadow,border-color] duration-300 ease-out hover:border-navy-100 hover:shadow-[0_2px_6px_rgba(11,26,51,0.06),0_24px_50px_-26px_rgba(11,26,51,0.45)]",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-none items-start justify-between gap-4 border-b border-admin-border/70 px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold text-admin-foreground">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-xs text-admin-foreground/55">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-admin-foreground/60">
        {children}
      </h2>
      <span className="h-px flex-1 bg-gradient-to-r from-gold-300 to-transparent" />
      {hint && <span className="text-xs text-admin-foreground/45">{hint}</span>}
    </div>
  );
}

/** Chip de variação mês a mês. Verde sobe, vermelho desce, cinza sem base. */
export function DeltaBadge({
  changePercent,
  label = "vs. mês anterior",
}: {
  changePercent: number | null;
  label?: string;
}) {
  if (changePercent === null) {
    return (
      <span className="text-xs text-admin-foreground/45">sem base de comparação</span>
    );
  }

  const up = changePercent >= 0;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium tabular",
          up ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
        )}
      >
        <span aria-hidden>{up ? "▲" : "▼"}</span>
        {formatNumber(Math.abs(changePercent), 1)}%
      </span>
      <span className="text-admin-foreground/45">{label}</span>
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-admin-border px-4 py-10 text-center text-sm text-admin-foreground/50 transition-colors duration-300 hover:border-gold-300/70 hover:bg-gold-50/30 hover:text-admin-foreground/70">
      {children}
    </p>
  );
}
