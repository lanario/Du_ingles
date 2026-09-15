"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CheckIcon, ChevronRightIcon, StarIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import {
  ACCENT_TONE,
  COMMITMENT_INTERVALS,
  COMMITMENT_LABEL,
  COMMITMENT_TAGLINE,
  COMMITMENT_TITLE,
  FREQUENCY_LABEL,
  FREQUENCY_TAGLINE,
  FREQUENCY_TITLE,
  RECOMMENDED_FREQUENCY,
  TIER_ACCENT,
  TIER_DESCRIPTION,
  TIER_LABEL,
  TIER_ORDER,
  TIER_TAGLINE,
  WEEKLY_FREQUENCIES,
  commitmentPriceCents,
  commitmentSavingsCents,
  formatMoney,
  splitMoney,
  tierFeatures,
  type CommitmentInterval,
} from "@/components/features/admin/plans/plans-utils";
import type { PlanTier, PlanWeeklyFrequency } from "@/schemas/student-plans";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Seção de preços da landing — o mesmo construtor "nível → ritmo →
 * compromisso" da vitrine do aluno (`/planos`), só que pública e sem banco:
 * o resultado vem direto da tabela comercial (`tier-catalog`), não de um
 * `StudentPlan` carregado por sessão. Sem conta, sem checkout — o CTA leva ao
 * formulário da aula experimental em `#faq`, como antes.
 *
 * Os três passos ficam sempre visíveis e editáveis assim que resolvidos —
 * escolher de novo o nível não reseta o ritmo já escolhido — e o cartão de
 * resultado mostra a lista cheia de benefícios do nível (cumulativa, não só
 * o que ele acrescenta), do mesmo jeito que o aluno vê depois de cadastrado.
 */
export function Pricing() {
  const rootRef = useRef<HTMLDivElement>(null);

  const [tier, setTier] = useState<PlanTier | null>(null);
  const [frequency, setFrequency] = useState<PlanWeeklyFrequency | null>(null);
  const [interval, setInterval] = useState<CommitmentInterval | null>(null);

  const matched = tier && frequency && interval ? { tier, frequency, interval } : null;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(root.querySelectorAll("[data-tier-card]"), {
          y: 24,
          opacity: 0,
          duration: 0.6,
          stagger: 0.09,
          ease: "power3.out",
          scrollTrigger: { trigger: root, start: "top 88%", once: true },
        });
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section id="planos">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Planos</h2>
        <p className="mt-3 max-w-2xl text-[15px] text-muted-foreground sm:text-base">
          Três passos: o nível de acompanhamento, o ritmo das aulas em grupo e o
          compromisso que faz mais sentido pra você. Escolha e já veja todos os
          benefícios do plano montado.
        </p>

        <div ref={rootRef} className="mt-8 space-y-8 sm:mt-10">
          <section className="space-y-4">
            <StepHeader
              index={1}
              title="Sua experiência"
              subtitle="O nível de acompanhamento que você quer ter."
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {TIER_ORDER.map((item) => (
                <TierCard
                  key={item}
                  tier={item}
                  selected={tier === item}
                  onSelect={() => setTier(item)}
                />
              ))}
            </div>
          </section>

          <AnimatePresence initial={false}>
            {tier && (
              <RevealSection key="frequency">
                <StepHeader
                  index={2}
                  title="Seu ritmo"
                  subtitle="Quantas aulas em grupo por semana."
                />
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {WEEKLY_FREQUENCIES.map((item) => (
                    <FrequencyCard
                      key={item}
                      frequency={item}
                      selected={frequency === item}
                      onSelect={() => setFrequency(item)}
                    />
                  ))}
                </div>
              </RevealSection>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {tier && frequency && (
              <RevealSection key="commitment">
                <StepHeader
                  index={3}
                  title="Seu compromisso"
                  subtitle="A periodicidade da cobrança — mais tempo, mais economia."
                />
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {COMMITMENT_INTERVALS.map((item) => (
                    <CommitmentCard
                      key={item}
                      interval={item}
                      tier={tier}
                      frequency={frequency}
                      selected={interval === item}
                      onSelect={() => setInterval(item)}
                    />
                  ))}
                </div>
              </RevealSection>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false} mode="wait">
            {matched && (
              <RevealSection key={`result-${matched.tier}-${matched.frequency}-${matched.interval}`}>
                <ResultCard
                  tier={matched.tier}
                  frequency={matched.frequency}
                  interval={matched.interval}
                  onPickTier={setTier}
                />
              </RevealSection>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Passos do construtor
// ---------------------------------------------------------------------------

function StepHeader({
  index,
  title,
  subtitle,
}: {
  index: number;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span
        aria-hidden
        className="text-xs font-bold tabular tracking-wide"
        style={{ color: "var(--gold-600)" }}
      >
        {String(index).padStart(2, "0")}
      </span>
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-foreground sm:text-lg">{title}</h3>
        {subtitle && (
          <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <span className="ml-2 h-px flex-1 bg-gradient-to-r from-border to-transparent" />
    </div>
  );
}

function RevealSection({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, height: 0, y: 12 }}
      animate={{ opacity: 1, height: "auto", y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, height: 0, y: -8 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden"
    >
      {children}
    </motion.section>
  );
}

function TierCard({
  tier,
  selected,
  onSelect,
}: {
  tier: PlanTier;
  selected: boolean;
  onSelect: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const tone = ACCENT_TONE[TIER_ACCENT[tier]];

  return (
    <motion.button
      type="button"
      data-tier-card
      onClick={onSelect}
      aria-pressed={selected}
      whileHover={reduceMotion ? undefined : { y: -3 }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className="group relative flex flex-col overflow-hidden rounded-2xl p-5 text-left transition-shadow duration-300"
      style={{
        background:
          "linear-gradient(168deg, var(--navy-950) 0%, var(--navy-900) 45%, var(--navy-800) 100%)",
        boxShadow: selected
          ? `inset 0 0 0 2px ${tone}, 0 20px 46px -20px rgba(5,15,34,0.7)`
          : "inset 0 0 0 1px color-mix(in srgb, var(--navy-600) 32%, transparent), 0 12px 30px -20px rgba(5,15,34,0.5)",
      }}
    >
      {selected && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-px h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${tone}, transparent)`,
          }}
        />
      )}

      <div className="flex items-center justify-between gap-2">
        <h4 className="text-lg font-bold text-white">{TIER_LABEL[tier]}</h4>
        <span
          aria-hidden
          className={cn(
            "grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-colors",
            selected ? "border-transparent" : "border-white/20",
          )}
          style={selected ? { backgroundColor: tone } : undefined}
        >
          {selected && (
            <CheckIcon
              className="h-3.5 w-3.5"
              style={{ color: "var(--navy-950)" }}
              strokeWidth={3}
            />
          )}
        </span>
      </div>

      <p className="mt-1 text-[13px] font-medium" style={{ color: tone }}>
        {TIER_TAGLINE[tier]}
      </p>
      <p
        className="mt-3 text-[13px] leading-relaxed"
        style={{ color: "var(--navy-300)" }}
      >
        {TIER_DESCRIPTION[tier]}
      </p>
    </motion.button>
  );
}

function FrequencyCard({
  frequency,
  selected,
  onSelect,
}: {
  frequency: PlanWeeklyFrequency;
  selected: boolean;
  onSelect: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const recommended = frequency === RECOMMENDED_FREQUENCY;

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      transition={{ type: "spring", stiffness: 340, damping: 30 }}
      className={cn(
        "relative flex flex-col gap-1.5 rounded-xl border px-4 py-3.5 text-left transition-colors",
        selected
          ? "border-gold-500 bg-gold-50/60"
          : "border-border bg-background hover:border-gold-300",
      )}
    >
      {recommended && (
        <span
          className="absolute -top-2.5 right-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
          style={{ backgroundColor: "var(--gold-500)", color: "var(--navy-950)" }}
        >
          <StarIcon className="h-2.5 w-2.5" fill="currentColor" strokeWidth={0} />
          Ideal
        </span>
      )}
      <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {FREQUENCY_LABEL[frequency]}
        {selected && (
          <CheckIcon
            className="h-3.5 w-3.5"
            style={{ color: "var(--gold-600)" }}
            strokeWidth={3}
          />
        )}
      </span>
      <span className="text-[11px] font-medium text-muted-foreground">
        {FREQUENCY_TITLE[frequency]}
      </span>
      <span className="text-[11px] leading-snug text-muted-foreground/80">
        {FREQUENCY_TAGLINE[frequency]}
      </span>
    </motion.button>
  );
}

function CommitmentCard({
  interval,
  tier,
  frequency,
  selected,
  onSelect,
}: {
  interval: CommitmentInterval;
  tier: PlanTier;
  frequency: PlanWeeklyFrequency;
  selected: boolean;
  onSelect: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const cents = commitmentPriceCents(tier, frequency, interval);
  const savings = commitmentSavingsCents(tier, frequency, interval);
  const monthly =
    interval === "month" ? cents : Math.round(cents / (interval === "semester" ? 6 : 12));

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      title={COMMITMENT_TAGLINE[interval]}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      transition={{ type: "spring", stiffness: 340, damping: 30 }}
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border px-4 py-3.5 text-left transition-colors",
        selected
          ? "border-gold-500 bg-gold-50/60"
          : "border-border bg-background hover:border-gold-300",
      )}
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {COMMITMENT_LABEL[interval]}
        {selected && (
          <CheckIcon
            className="h-3.5 w-3.5"
            style={{ color: "var(--gold-600)" }}
            strokeWidth={3}
          />
        )}
      </span>
      <span className="text-[11px] font-medium text-muted-foreground">
        {COMMITMENT_TITLE[interval]}
      </span>
      <span className="mt-0.5 flex items-baseline gap-1 tabular">
        <span className="text-sm font-semibold text-foreground">
          {formatMoney(monthly)}
        </span>
        <span className="text-[11px] text-muted-foreground">/mês</span>
      </span>
      {savings > 0 && (
        <span className="text-[11px] font-medium text-[color:var(--success)]">
          economize {formatMoney(savings)}
        </span>
      )}
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Resultado — o plano montado, com todos os benefícios do nível
// ---------------------------------------------------------------------------

const INTERVAL_SUFFIX: Record<CommitmentInterval, string> = {
  month: "/mês",
  semester: "/semestre",
  year: "/ano",
};

function ResultCard({
  tier,
  frequency,
  interval,
  onPickTier,
}: {
  tier: PlanTier;
  frequency: PlanWeeklyFrequency;
  interval: CommitmentInterval;
  onPickTier: (tier: PlanTier) => void;
}) {
  const tone = ACCENT_TONE[TIER_ACCENT[tier]];
  const priceCents = commitmentPriceCents(tier, frequency, interval);
  const { symbol, whole, fraction } = splitMoney(priceCents);
  const monthly =
    interval === "month" ? null : Math.round(priceCents / (interval === "semester" ? 6 : 12));
  const savings = commitmentSavingsCents(tier, frequency, interval);
  const features = tierFeatures(tier);

  const alternatives = TIER_ORDER.filter((item) => item !== tier).map((item) => ({
    tier: item,
    priceCents: commitmentPriceCents(item, frequency, interval),
  }));

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
      <motion.article
        layout
        className="relative flex flex-col overflow-hidden rounded-2xl p-6 sm:p-7"
        style={{
          background:
            "linear-gradient(168deg, var(--navy-950) 0%, var(--navy-900) 40%, var(--navy-800) 100%)",
          boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone} 32%, transparent), 0 26px 60px -20px rgba(5,15,34,0.7)`,
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-px h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${tone}, transparent)`,
          }}
        />

        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{ color: tone }}
            >
              Seu plano
            </p>
            <h3 className="mt-1 text-2xl font-bold text-white">
              {TIER_LABEL[tier]} · {FREQUENCY_LABEL[frequency]}
            </h3>
            <p className="mt-1 text-[13px]" style={{ color: "var(--navy-300)" }}>
              {COMMITMENT_LABEL[interval]}
            </p>
          </div>
        </div>

        <div className="relative mt-5">
          <p className="flex items-baseline gap-1 leading-none">
            <span className="text-sm font-medium" style={{ color: "var(--navy-300)" }}>
              {symbol}
            </span>
            <span className="text-[46px] font-bold tracking-tight text-white">{whole}</span>
            <span
              className="text-lg font-semibold tabular"
              style={{ color: "var(--navy-300)" }}
            >
              ,{fraction}
            </span>
            <span className="text-sm font-medium" style={{ color: "var(--navy-300)" }}>
              {INTERVAL_SUFFIX[interval]}
            </span>
          </p>

          <div
            className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]"
            style={{ color: "var(--navy-300)" }}
          >
            {monthly !== null && <span>≈ {formatMoney(monthly)}/mês</span>}
            {savings > 0 && (
              <span className="font-semibold text-[color:var(--success)]">
                você economiza {formatMoney(savings)}
              </span>
            )}
          </div>
        </div>

        <div
          className="my-5 h-px w-full"
          style={{ background: `color-mix(in srgb, ${tone} 18%, transparent)` }}
        />

        <ul className="relative grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-[13px] leading-snug">
              <CheckIcon
                aria-hidden
                className="mt-0.5 h-4 w-4 shrink-0"
                strokeWidth={2.4}
                style={{ color: "var(--gold-400)" }}
              />
              <span className="min-w-0 font-medium text-white/80">{feature}</span>
            </li>
          ))}
        </ul>

        <div className="relative mt-auto pt-6">
          <a
            href="#faq"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-[13px] font-bold uppercase tracking-[0.08em] transition-all duration-200 sm:w-auto"
            style={{ background: tone, color: "var(--navy-950)", border: `1px solid ${tone}` }}
          >
            Começar agora
          </a>

          <p className="mt-2 text-[11px]" style={{ color: "var(--navy-300)" }}>
            Pagamento seguro via Stripe · cancele quando quiser
          </p>
        </div>
      </motion.article>

      <div className="space-y-2.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Talvez você prefira
        </p>
        {alternatives.map(({ tier: altTier, priceCents: altPriceCents }) => (
          <button
            key={altTier}
            type="button"
            onClick={() => onPickTier(altTier)}
            className="group flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background px-3.5 py-3 text-left transition-colors hover:border-gold-300"
          >
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-foreground">
                {TIER_LABEL[altTier]}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {formatMoney(altPriceCents)}
                {INTERVAL_SUFFIX[interval]}
              </span>
            </span>
            <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
          </button>
        ))}
      </div>
    </div>
  );
}
