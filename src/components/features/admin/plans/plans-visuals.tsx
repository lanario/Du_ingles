"use client";

/**
 * Peças visuais do domínio de planos.
 *
 * A peça central é o **preço**: numa lista de planos é o número que se
 * procura primeiro, então ele ganha o tratamento tipográfico (símbolo e
 * centavos menores, inteiro grande, sufixo discreto) e o count-up do GSAP.
 * O resto — selos de status, medidor de vagas, botão de copiar link — orbita
 * em torno dele.
 *
 * Divisão das libs, igual ao resto do painel: Framer Motion no ciclo de vida
 * do React (entrada, layout, hover) e GSAP no que é imperativo e contínuo
 * (count-up amarrado ao scroll, brilho do medidor).
 */

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion, useReducedMotion } from "framer-motion";
import { CheckIcon, CopyIcon, ClockIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import {
  ACCENT_TONE,
  INTERVAL_LABEL,
  INTERVAL_SUFFIX,
  formatMoney,
  monthlyEquivalentCents,
  occupancyRatio,
  seatsLeft,
  splitMoney,
  syncBadge,
  type StudentPlan,
} from "./plans-utils";
import type { PlanAccent } from "@/schemas/student-plans";
import { LogoLoader } from "@/components/ui/logo-loader";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// ---------------------------------------------------------------------------
// Preço
// ---------------------------------------------------------------------------

/**
 * O valor final já vem no HTML do servidor e o tween só reescreve o
 * `textContent` depois da hidratação — sem flash de "0", sem mismatch, e sem
 * JS o preço continua correto. Mesmo contrato do `CountUp` do dashboard.
 */
function useMoneyCountUp(cents: number) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    const state = { current: 0 };
    const format = new Intl.NumberFormat("pt-BR");
    const tween = gsap.to(state, {
      current: Math.floor(cents / 100),
      duration: 1.1,
      ease: "power3.out",
      onUpdate: () => {
        el.textContent = format.format(Math.round(state.current));
      },
      scrollTrigger: { trigger: el, start: "top 95%", once: true },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [cents]);

  return ref;
}

export function PriceTag({
  plan,
  size = "md",
  className,
}: {
  plan: StudentPlan;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { symbol, whole, fraction } = splitMoney(plan.priceCents);
  const wholeRef = useMoneyCountUp(plan.priceCents);
  const monthly = monthlyEquivalentCents(plan);

  const wholeSize =
    size === "lg" ? "text-[44px]" : size === "md" ? "text-[30px]" : "text-[22px]";

  return (
    <div className={cn("min-w-0", className)}>
      <p className="flex items-baseline gap-1 leading-none text-admin-foreground">
        <span
          className={cn(
            "font-medium text-admin-foreground/45",
            size === "lg" ? "text-lg" : "text-[13px]",
          )}
        >
          {symbol}
        </span>
        <span className={cn("font-semibold tabular tracking-tight", wholeSize)}>
          <span ref={wholeRef}>{whole}</span>
        </span>
        <span
          className={cn(
            "font-semibold tabular text-admin-foreground/55",
            size === "lg" ? "text-xl" : "text-sm",
          )}
        >
          ,{fraction}
        </span>
        <span
          className={cn(
            "font-medium text-admin-foreground/45",
            size === "lg" ? "text-base" : "text-[13px]",
          )}
        >
          {INTERVAL_SUFFIX[plan.billingInterval]}
        </span>
      </p>

      {monthly !== null && (
        <p className="mt-1 text-[11px] text-admin-foreground/45">
          equivale a {formatMoney(monthly, plan.currency)} por mês
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Selos
// ---------------------------------------------------------------------------

/** Selo genérico tingido por um tom — a forma padrão de status no painel. */
export function TonePill({
  tone,
  children,
  dot = true,
  title,
}: {
  tone: string;
  children: React.ReactNode;
  dot?: boolean;
  title?: string;
}) {
  return (
    <span
      title={title}
      style={{ color: tone, backgroundColor: `color-mix(in srgb, ${tone} 10%, #ffffff)` }}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
    >
      {dot && (
        <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tone }} />
      )}
      {children}
    </span>
  );
}

export function SyncPill({ plan }: { plan: StudentPlan }) {
  const badge = syncBadge(plan);
  return (
    <TonePill tone={badge.tone} title={badge.hint}>
      {badge.label}
    </TonePill>
  );
}

export function IntervalPill({ plan }: { plan: StudentPlan }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-admin-muted px-2.5 py-1 text-[11px] font-medium text-admin-foreground/60">
      <ClockIcon className="h-3 w-3" />
      {INTERVAL_LABEL[plan.billingInterval]}
    </span>
  );
}

export function VisibilityPill({ plan }: { plan: StudentPlan }) {
  if (!plan.isActive) {
    return <TonePill tone="var(--muted-foreground)">Arquivado</TonePill>;
  }
  return plan.isPublic ? (
    <TonePill tone="var(--navy-500)" title="Aparece na vitrine do aluno.">
      Na vitrine
    </TonePill>
  ) : (
    <TonePill tone="var(--warning)" title="Só por link enviado pelo admin.">
      Só por link
    </TonePill>
  );
}

/** Selo livre escrito pelo admin ("Mais vendido", "Turma nova"). */
export function BadgePill({ text, accent }: { text: string; accent: PlanAccent }) {
  const tone = ACCENT_TONE[accent];
  return (
    <span
      style={{
        color: tone,
        backgroundColor: `color-mix(in srgb, ${tone} 12%, #ffffff)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone} 32%, transparent)`,
      }}
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
    >
      {text}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Vagas
// ---------------------------------------------------------------------------

/**
 * Medidor de vagas. Só aparece em plano com teto — num plano ilimitado a
 * barra estaria sempre vazia e não diria nada.
 */
export function SeatMeter({ plan, className }: { plan: StudentPlan; className?: string }) {
  const reduceMotion = useReducedMotion();
  const left = seatsLeft(plan);
  if (left === null) return null;

  const ratio = occupancyRatio(plan);
  const tone =
    ratio >= 1 ? "var(--destructive)" : ratio >= 0.8 ? "var(--warning)" : "var(--success)";

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-baseline justify-between gap-2 text-[11px]">
        <span className="font-medium tabular text-admin-foreground/70">
          {plan.activeSubscribers}/{plan.seatLimit}
        </span>
        <span className="truncate text-admin-foreground/45">
          {left === 0 ? "esgotado" : `${left} ${left === 1 ? "vaga" : "vagas"}`}
        </span>
      </div>
      <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-admin-muted">
        <motion.span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ backgroundColor: tone }}
          initial={reduceMotion ? { width: `${ratio * 100}%` } : { width: 0 }}
          animate={{ width: `${ratio * 100}%` }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Benefícios
// ---------------------------------------------------------------------------

/**
 * Lista de benefícios com entrada escalonada. O `delay` por índice é o que
 * faz a lista "escorrer" em vez de piscar inteira — e some com
 * `prefers-reduced-motion`.
 */
export function FeatureList({
  features,
  accent,
  limit,
  className,
}: {
  features: string[];
  accent: PlanAccent;
  limit?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const tone = ACCENT_TONE[accent];
  const shown = limit ? features.slice(0, limit) : features;
  const hidden = features.length - shown.length;

  if (features.length === 0) return null;

  return (
    <ul className={cn("space-y-2", className)}>
      {shown.map((feature, index) => (
        <motion.li
          key={feature}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: reduceMotion ? 0 : 0.05 + index * 0.045, duration: 0.35 }}
          className="flex items-start gap-2 text-[13px] leading-snug text-admin-foreground/70"
        >
          <span
            aria-hidden
            style={{ color: tone, backgroundColor: `color-mix(in srgb, ${tone} 12%, #ffffff)` }}
            className="mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full"
          >
            <CheckIcon className="h-2.5 w-2.5" strokeWidth={2.6} />
          </span>
          <span className="min-w-0">{feature}</span>
        </motion.li>
      ))}

      {hidden > 0 && (
        <li className="pl-6 text-[12px] text-admin-foreground/40">
          + {hidden} {hidden === 1 ? "benefício" : "benefícios"}
        </li>
      )}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Link de pagamento
// ---------------------------------------------------------------------------

/**
 * Copiar o link é a ação mais repetida da tela — o admin manda o mesmo link
 * para cada aluno novo. O feedback de "copiado" dura dois segundos, tempo de
 * o olho registrar sem virar ruído.
 */
export function CopyLinkButton({
  url,
  label = "Copiar link",
  className,
}: {
  url: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard negado (http sem TLS, permissão): o link segue visível no
      // painel de detalhe para seleção manual.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Link copiado" : label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
        copied
          ? "text-[color:var(--success)]"
          : "text-admin-foreground/55 hover:bg-admin-muted hover:text-admin-foreground",
        className,
      )}
    >
      {copied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
      {copied ? "Copiado!" : label}
    </button>
  );
}

/** Spinner de ação em andamento, com o rótulo do que está acontecendo. */
export function BusyLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12px] text-admin-foreground/55">
      <LogoLoader size={14} label={null} />
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Fundo
// ---------------------------------------------------------------------------

/**
 * Véu de cor no hover do cartão, tingido pelo acento do plano. É o mesmo
 * `tone-glow` dos cartões de turma; aqui a cor conta qual plano é qual antes
 * mesmo de o olho chegar no nome.
 */
export function AccentAura({ accent }: { accent: PlanAccent }) {
  const tone = ACCENT_TONE[accent];
  return (
    <span
      aria-hidden
      style={{
        background: `radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, ${tone} 16%, transparent) 0%, transparent 70%)`,
      }}
      className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
    />
  );
}
