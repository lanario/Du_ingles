"use client";

/**
 * Vitrine de planos do aluno — a tela onde ele escolhe e assina.
 *
 * Construtor em três passos, como o material comercial da escola descreve:
 * **nível** (Standard/Premium/Elite) → **ritmo** (1x/2x/3x por semana) →
 * **compromisso** (Mensal/Semestral/Anual). Cada eixo é independente dos
 * outros dois, então os três ficam sempre visíveis e editáveis — escolher de
 * novo o nível não invalida o ritmo já escolhido. O resultado (`findTierPlan`)
 * é só uma busca no catálogo já carregado pelos três valores; nada aqui
 * calcula preço no cliente além da prévia de cada opção.
 *
 * Um plano "avulso" (sem `tier`) continua vendável — aparece numa grade
 * simples abaixo do construtor, do jeito que a vitrine funcionava antes.
 *
 * Movimento, como no resto da plataforma: GSAP no que é contínuo e ligado à
 * rolagem (entrada em cascata dos cartões) e Framer no ciclo de vida do
 * React (troca de passo, seleção, hover, estado do botão).
 */

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  openBillingPortalAction,
  startPlanCheckoutAction,
} from "@/actions/student/subscriptions";
import { CountUp } from "@/components/features/admin/dashboard/primitives";
import {
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  ShieldIcon,
  StarIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { PlanTier, PlanWeeklyFrequency } from "@/schemas/student-plans";
import {
  ACCENT_TONE,
  COMMITMENT_INTERVALS,
  COMMITMENT_LABEL,
  COMMITMENT_TAGLINE,
  COMMITMENT_TITLE,
  FREQUENCY_LABEL,
  FREQUENCY_TAGLINE,
  FREQUENCY_TITLE,
  INTERVAL_LABEL,
  INTERVAL_SUFFIX,
  RECOMMENDED_FREQUENCY,
  TIER_ACCENT,
  TIER_DESCRIPTION,
  TIER_LABEL,
  TIER_ORDER,
  TIER_TAGLINE,
  WEEKLY_FREQUENCIES,
  commitmentPriceCents,
  commitmentSavingsCents,
  findTierPlan,
  formatMoney,
  monthlyEquivalentCents,
  seatsLeft,
  splitMoney,
  type CommitmentInterval,
  type StudentPlan,
} from "@/components/features/admin/plans/plans-utils";
import type { StudentSubscription } from "@/repositories/student-subscriptions";
import { LogoLoader } from "@/components/ui/logo-loader";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface PlansShowcaseProps {
  plans: StudentPlan[];
  subscription: StudentSubscription | null;
  /** `true` durante "ver como": nada é cobrável. */
  readOnly: boolean;
  /** Vindo de `?assinatura=` — o retorno do checkout da Stripe. */
  outcome: "confirmada" | "cancelada" | null;
}

export function PlansShowcase({
  plans,
  subscription,
  readOnly,
  outcome,
}: PlansShowcaseProps) {
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const tierPlans = useMemo(() => plans.filter((plan) => plan.tier !== null), [plans]);
  const loosePlans = useMemo(() => plans.filter((plan) => plan.tier === null), [plans]);

  async function subscribe(plan: StudentPlan) {
    setError(null);
    setPendingPlan(plan.id);
    try {
      const result = await startPlanCheckoutAction(plan.id);
      if (!result.success) {
        setError(result.error.message);
        setPendingPlan(null);
        return;
      }
      // Sai da plataforma para o checkout hospedado da Stripe. Não limpamos o
      // `pending`: o botão fica travado até a navegação acontecer, e destravar
      // antes convidaria a um duplo clique que abriria dois checkouts.
      window.location.href = result.data.url;
    } catch {
      setError("Não foi possível abrir o pagamento. Tente novamente.");
      setPendingPlan(null);
    }
  }

  function openPortal() {
    setError(null);
    startTransition(async () => {
      const result = await openBillingPortalAction();
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      window.location.href = result.data.url;
    });
  }

  return (
    <div className="pb-12">
      <header className="max-w-2xl">
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
          Escolha como você quer aprender inglês
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Três passos: o nível de acompanhamento, o ritmo das aulas em grupo e o
          compromisso que faz mais sentido pra você. Pode trocar ou cancelar quando quiser.
        </p>
      </header>

      <AnimatePresence>
        {outcome === "confirmada" && (
          <Banner tone="var(--success)" icon={CheckIcon}>
            Pagamento recebido! A confirmação da Stripe pode levar alguns instantes —
            assim que ela chegar, seu plano aparece aqui como ativo.
          </Banner>
        )}
        {outcome === "cancelada" && (
          <Banner tone="var(--muted-foreground)" icon={ClockIcon}>
            Checkout cancelado. Nada foi cobrado — seu plano continua como estava.
          </Banner>
        )}
        {error && (
          <Banner tone="var(--destructive)" icon={ShieldIcon}>
            {error}
          </Banner>
        )}
      </AnimatePresence>

      {subscription && (
        <CurrentPlan subscription={subscription} readOnly={readOnly} onManage={openPortal} />
      )}

      {plans.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
          <p className="text-sm text-muted-foreground">
            A escola ainda não publicou planos. Fale com a coordenação para conhecer as
            opções disponíveis.
          </p>
        </div>
      ) : (
        <>
          {tierPlans.length > 0 && (
            <TierBuilder
              plans={tierPlans}
              pendingPlan={pendingPlan}
              disabled={readOnly || pendingPlan !== null}
              readOnly={readOnly}
              currentPlanId={subscription?.planId ?? null}
              onSubscribe={subscribe}
            />
          )}

          {loosePlans.length > 0 && (
            <LoosePlansGrid
              plans={loosePlans}
              pendingPlan={pendingPlan}
              disabled={readOnly || pendingPlan !== null}
              readOnly={readOnly}
              currentPlanId={subscription?.planId ?? null}
              onSubscribe={subscribe}
            />
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Construtor "nível → ritmo → compromisso"
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
        <h2 className="text-base font-semibold text-foreground sm:text-lg">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p>}
      </div>
      <span className="ml-2 h-px flex-1 bg-gradient-to-r from-border to-transparent" />
    </div>
  );
}

function TierBuilder({
  plans,
  pendingPlan,
  disabled,
  readOnly,
  currentPlanId,
  onSubscribe,
}: {
  plans: StudentPlan[];
  pendingPlan: string | null;
  disabled: boolean;
  readOnly: boolean;
  currentPlanId: string | null;
  onSubscribe: (plan: StudentPlan) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  const availableTiers = useMemo(
    () => TIER_ORDER.filter((tier) => plans.some((plan) => plan.tier === tier)),
    [plans],
  );
  const availableFrequencies = useMemo(
    () => WEEKLY_FREQUENCIES.filter((freq) => plans.some((plan) => plan.weeklyFrequency === freq)),
    [plans],
  );
  const availableCommitments = useMemo(
    () => COMMITMENT_INTERVALS.filter((iv) => plans.some((plan) => plan.billingInterval === iv)),
    [plans],
  );

  const [tier, setTier] = useState<PlanTier | null>(null);
  const [frequency, setFrequency] = useState<PlanWeeklyFrequency | null>(null);
  const [interval, setInterval] = useState<CommitmentInterval | null>(null);

  const matched = useMemo(
    () => (tier && frequency && interval ? findTierPlan(plans, tier, frequency, interval) : null),
    [plans, tier, frequency, interval],
  );

  // Cascata de entrada do grid de níveis — o único bloco sempre visível, os
  // demais entram por `AnimatePresence` quando o passo anterior é resolvido.
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
  }, [availableTiers.length]);

  return (
    <div ref={rootRef} className="mt-8 space-y-8">
      <section className="space-y-4">
        <StepHeader
          index={1}
          title="Sua experiência"
          subtitle="O nível de acompanhamento que você quer ter."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {availableTiers.map((item) => (
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
              {availableFrequencies.map((item) => (
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
              {availableCommitments.map((item) => (
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
        {tier && frequency && interval && (
          <RevealSection key={`result-${tier}-${frequency}-${interval}`}>
            {matched ? (
              <ResultCard
                plan={matched}
                tier={tier}
                frequency={frequency}
                interval={interval}
                pending={pendingPlan === matched.id}
                disabled={disabled}
                readOnly={readOnly}
                current={currentPlanId === matched.id}
                allPlans={plans}
                onSubscribe={() => onSubscribe(matched)}
                onPickTier={setTier}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-border px-6 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Essa combinação ainda não está disponível. Fale com a coordenação ou
                  escolha outro ritmo ou compromisso.
                </p>
              </div>
            )}
          </RevealSection>
        )}
      </AnimatePresence>
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
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className="group relative flex flex-col overflow-hidden rounded-2xl p-5 text-left transition-shadow duration-300"
      style={{
        background: "linear-gradient(168deg, var(--navy-950) 0%, var(--navy-900) 45%, var(--navy-800) 100%)",
        boxShadow: selected
          ? `inset 0 0 0 2px ${tone}, 0 20px 46px -20px rgba(5,15,34,0.7)`
          : "inset 0 0 0 1px color-mix(in srgb, var(--navy-600) 32%, transparent), 0 12px 30px -20px rgba(5,15,34,0.5)",
      }}
    >
      {selected && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-px h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${tone}, transparent)` }}
        />
      )}

      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-bold text-white">{TIER_LABEL[tier]}</h3>
        <span
          aria-hidden
          className={cn(
            "grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-colors",
            selected ? "border-transparent" : "border-white/20",
          )}
          style={selected ? { backgroundColor: tone } : undefined}
        >
          {selected && <CheckIcon className="h-3.5 w-3.5" style={{ color: "var(--navy-950)" }} strokeWidth={3} />}
        </span>
      </div>

      <p className="mt-1 text-[13px] font-medium" style={{ color: tone }}>
        {TIER_TAGLINE[tier]}
      </p>
      <p className="mt-3 text-[13px] leading-relaxed" style={{ color: "var(--navy-300)" }}>
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
        {selected && <CheckIcon className="h-3.5 w-3.5" style={{ color: "var(--gold-600)" }} strokeWidth={3} />}
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
  const monthly = interval === "month" ? cents : Math.round(cents / (interval === "semester" ? 6 : 12));

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
        {selected && <CheckIcon className="h-3.5 w-3.5" style={{ color: "var(--gold-600)" }} strokeWidth={3} />}
      </span>
      <span className="text-[11px] font-medium text-muted-foreground">
        {COMMITMENT_TITLE[interval]}
      </span>
      <span className="mt-0.5 flex items-baseline gap-1 tabular">
        <span className="text-sm font-semibold text-foreground">{formatMoney(monthly)}</span>
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

function ResultCard({
  plan,
  tier,
  frequency,
  interval,
  pending,
  disabled,
  readOnly,
  current,
  allPlans,
  onSubscribe,
  onPickTier,
}: {
  plan: StudentPlan;
  tier: PlanTier;
  frequency: PlanWeeklyFrequency;
  interval: CommitmentInterval;
  pending: boolean;
  disabled: boolean;
  readOnly: boolean;
  current: boolean;
  allPlans: StudentPlan[];
  onSubscribe: () => void;
  onPickTier: (tier: PlanTier) => void;
}) {
  const tone = ACCENT_TONE[TIER_ACCENT[tier]];
  const { symbol, whole, fraction } = splitMoney(plan.priceCents);
  const monthly = monthlyEquivalentCents(plan);
  const savings = commitmentSavingsCents(tier, frequency, interval);
  const left = seatsLeft(plan);
  const soldOut = left === 0;

  const alternatives = TIER_ORDER.filter((item) => item !== tier).map((item) => ({
    tier: item,
    plan: findTierPlan(allPlans, item, frequency, interval),
  }));

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
      <motion.article
        layout
        className="relative flex flex-col overflow-hidden rounded-2xl p-6 sm:p-7"
        style={{
          background: "linear-gradient(168deg, var(--navy-950) 0%, var(--navy-900) 40%, var(--navy-800) 100%)",
          boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone} 32%, transparent), 0 26px 60px -20px rgba(5,15,34,0.7)`,
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-px h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${tone}, transparent)` }}
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
              {COMMITMENT_LABEL[interval]} — {INTERVAL_LABEL[plan.billingInterval]}
            </p>
          </div>
          {plan.badge && (
            <span
              style={{ color: "var(--navy-950)", backgroundColor: tone }}
              className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
            >
              {plan.badge}
            </span>
          )}
        </div>

        <div className="relative mt-5">
          <p className="flex items-baseline gap-1 leading-none">
            <span className="text-sm font-medium" style={{ color: "var(--navy-300)" }}>
              {symbol}
            </span>
            <CountUp
              key={plan.id}
              value={Number(whole.replace(/\D/g, ""))}
              className="text-[46px] font-bold tracking-tight text-white"
            />
            <span className="text-lg font-semibold tabular" style={{ color: "var(--navy-300)" }}>
              ,{fraction}
            </span>
            <span className="text-sm font-medium" style={{ color: "var(--navy-300)" }}>
              {INTERVAL_SUFFIX[plan.billingInterval]}
            </span>
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]" style={{ color: "var(--navy-300)" }}>
            {monthly !== null && <span>≈ {formatMoney(monthly, plan.currency)}/mês</span>}
            {savings > 0 && (
              <span className="font-semibold text-[color:var(--success)]">
                você economiza {formatMoney(savings, plan.currency)}
              </span>
            )}
          </div>
        </div>

        <div
          className="my-5 h-px w-full"
          style={{ background: `color-mix(in srgb, ${tone} 18%, transparent)` }}
        />

        {plan.features.length > 0 && (
          <ul className="relative grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {plan.features.map((feature) => (
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
        )}

        <div className="relative mt-auto pt-6">
          {left !== null && left > 0 && left <= 5 && (
            <p className="mb-2 text-[12px] font-medium text-[color:var(--warning)]">
              Últimas {left} {left === 1 ? "vaga" : "vagas"}
            </p>
          )}

          <button
            type="button"
            onClick={onSubscribe}
            disabled={disabled || current || soldOut}
            title={readOnly ? "Modo somente leitura — nada é cobrado aqui." : undefined}
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-[13px] font-bold uppercase tracking-[0.08em] transition-all duration-200 sm:w-auto",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
            style={
              current
                ? {
                    background: "color-mix(in srgb, var(--navy-600) 40%, transparent)",
                    color: "var(--navy-300)",
                    border: "1px solid color-mix(in srgb, var(--navy-500) 28%, transparent)",
                  }
                : soldOut
                  ? {
                      background: "color-mix(in srgb, var(--navy-600) 20%, transparent)",
                      color: "var(--navy-300)",
                      border: "1px solid color-mix(in srgb, var(--navy-500) 18%, transparent)",
                    }
                  : { background: tone, color: "var(--navy-950)", border: `1px solid ${tone}` }
            }
          >
            {pending && <LogoLoader size={16} label={null} />}
            {current
              ? "Seu plano atual"
              : soldOut
                ? "Vagas esgotadas"
                : pending
                  ? "Abrindo pagamento..."
                  : plan.trialDays > 0
                    ? "Começar teste grátis"
                    : "Começar agora"}
          </button>

          <p className="mt-2 text-[11px]" style={{ color: "var(--navy-300)" }}>
            Pagamento seguro via Stripe · cancele quando quiser
          </p>
        </div>
      </motion.article>

      {alternatives.some((alt) => alt.plan) && (
        <div className="space-y-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Talvez você prefira
          </p>
          {alternatives.map(
            ({ tier: altTier, plan: altPlan }) =>
              altPlan && (
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
                      {formatMoney(altPlan.priceCents, altPlan.currency)}
                      {INTERVAL_SUFFIX[altPlan.billingInterval]}
                    </span>
                  </span>
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
                </button>
              ),
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Planos avulsos — fora da grade de níveis, vendidos como antes.
// ---------------------------------------------------------------------------

function LoosePlansGrid({
  plans,
  pendingPlan,
  disabled,
  readOnly,
  currentPlanId,
  onSubscribe,
}: {
  plans: StudentPlan[];
  pendingPlan: string | null;
  disabled: boolean;
  readOnly: boolean;
  currentPlanId: string | null;
  onSubscribe: (plan: StudentPlan) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(grid.querySelectorAll("[data-plan-card]"), {
          y: 28,
          opacity: 0,
          duration: 0.65,
          stagger: 0.09,
          ease: "power3.out",
          scrollTrigger: { trigger: grid, start: "top 85%", once: true },
        });
      });
    }, grid);
    return () => ctx.revert();
  }, [plans.length]);

  return (
    <section className="mt-12">
      <div className="flex items-baseline gap-3">
        <h2 className="text-base font-semibold text-foreground sm:text-lg">Outros planos</h2>
        <span className="text-[13px] text-muted-foreground">Fora da grade de níveis</span>
        <span className="ml-2 h-px flex-1 bg-gradient-to-r from-border to-transparent" />
      </div>
      <div ref={gridRef} className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => (
          <LoosePlanCard
            key={plan.id}
            plan={plan}
            current={currentPlanId === plan.id}
            pending={pendingPlan === plan.id}
            disabled={disabled}
            readOnly={readOnly}
            onSubscribe={() => onSubscribe(plan)}
          />
        ))}
      </div>
    </section>
  );
}

function LoosePlanCard({
  plan,
  current,
  pending,
  disabled,
  readOnly,
  onSubscribe,
}: {
  plan: StudentPlan;
  current: boolean;
  pending: boolean;
  disabled: boolean;
  readOnly: boolean;
  onSubscribe: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const tone = ACCENT_TONE[plan.accent];
  const { symbol, whole, fraction } = splitMoney(plan.priceCents);
  const monthly = monthlyEquivalentCents(plan);
  const left = seatsLeft(plan);
  const soldOut = left === 0;

  return (
    <motion.article
      data-plan-card
      layout
      whileHover={reduceMotion ? undefined : { y: -4 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className="group relative flex flex-col overflow-hidden rounded-2xl p-6"
      style={{
        background: plan.isFeatured
          ? "linear-gradient(168deg, var(--navy-950) 0%, var(--navy-900) 40%, var(--navy-800) 100%)"
          : "linear-gradient(168deg, var(--navy-950) 0%, var(--navy-900) 100%)",
        boxShadow: plan.isFeatured
          ? `inset 0 0 0 1px color-mix(in srgb, ${tone} 28%, transparent), 0 24px 60px -16px rgba(5,15,34,0.7)`
          : "inset 0 0 0 1px color-mix(in srgb, var(--navy-600) 32%, transparent), 0 16px 40px -20px rgba(5,15,34,0.5)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className="mb-3 inline-flex w-fit items-center rounded-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em]"
          style={{
            color: plan.isFeatured ? "var(--gold-400)" : "var(--navy-300)",
            border: `1px solid ${
              plan.isFeatured
                ? `color-mix(in srgb, ${tone} 32%, transparent)`
                : "color-mix(in srgb, var(--navy-500) 28%, transparent)"
            }`,
            background: plan.isFeatured
              ? `color-mix(in srgb, ${tone} 8%, transparent)`
              : "color-mix(in srgb, var(--navy-600) 12%, transparent)",
          }}
        >
          {INTERVAL_LABEL[plan.billingInterval]}
        </span>
        {plan.badge && (
          <span
            style={{
              color: plan.isFeatured ? "var(--navy-950)" : tone,
              backgroundColor: plan.isFeatured ? tone : `color-mix(in srgb, ${tone} 16%, transparent)`,
            }}
            className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
          >
            {plan.badge}
          </span>
        )}
      </div>

      <h3 className="truncate text-xl font-bold text-white">{plan.name}</h3>
      {plan.headline && (
        <p className="mt-1.5 text-[13px] leading-snug" style={{ color: "var(--navy-300)" }}>
          {plan.headline}
        </p>
      )}

      <div className="mt-5">
        <p className="flex items-baseline gap-1 leading-none">
          <span className="text-sm font-medium" style={{ color: "var(--navy-300)" }}>
            {symbol}
          </span>
          <span className="text-[44px] font-bold tabular tracking-tight text-white">{whole}</span>
          <span className="text-lg font-semibold tabular" style={{ color: "var(--navy-300)" }}>
            ,{fraction}
          </span>
        </p>
        {monthly !== null && (
          <p className="mt-1.5 text-[12px]" style={{ color: "var(--navy-300)" }}>
            ≈ {formatMoney(monthly, plan.currency)}/mês
          </p>
        )}
      </div>

      <div
        className="my-5 h-px w-full"
        style={{
          background: plan.isFeatured
            ? `color-mix(in srgb, ${tone} 18%, transparent)`
            : "color-mix(in srgb, var(--navy-600) 28%, transparent)",
        }}
      />

      {plan.features.length > 0 && (
        <ul className="flex-1 space-y-3">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-[13px] leading-snug">
              <CheckIcon
                aria-hidden
                className="mt-0.5 h-4 w-4 shrink-0"
                strokeWidth={2.4}
                style={{ color: plan.isFeatured ? "var(--gold-500)" : "var(--gold-400)" }}
              />
              <span className="min-w-0 font-medium text-white/80">{feature}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-6">
        {left !== null && left > 0 && left <= 5 && (
          <p className="mb-2 text-center text-[12px] font-medium text-[color:var(--warning)]">
            Últimas {left} {left === 1 ? "vaga" : "vagas"}
          </p>
        )}
        <button
          type="button"
          onClick={onSubscribe}
          disabled={disabled || current || soldOut}
          title={readOnly ? "Modo somente leitura — nada é cobrado aqui." : undefined}
          className={cn(
            "inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-[13px] font-bold uppercase tracking-[0.08em] transition-all duration-200",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
          style={
            current
              ? {
                  background: "color-mix(in srgb, var(--navy-600) 40%, transparent)",
                  color: "var(--navy-300)",
                  border: "1px solid color-mix(in srgb, var(--navy-500) 28%, transparent)",
                }
              : soldOut
                ? {
                    background: "color-mix(in srgb, var(--navy-600) 20%, transparent)",
                    color: "var(--navy-300)",
                    border: "1px solid color-mix(in srgb, var(--navy-500) 18%, transparent)",
                  }
                : plan.isFeatured
                  ? { background: tone, color: "var(--navy-950)", border: `1px solid ${tone}` }
                  : {
                      background: "color-mix(in srgb, var(--navy-600) 40%, transparent)",
                      color: "white",
                      border: "1px solid color-mix(in srgb, var(--navy-500) 40%, transparent)",
                    }
          }
        >
          {pending && <LogoLoader size={16} label={null} />}
          {current
            ? "Seu plano atual"
            : soldOut
              ? "Vagas esgotadas"
              : pending
                ? "Abrindo pagamento..."
                : plan.trialDays > 0
                  ? "Começar teste grátis"
                  : "Assinar este plano"}
        </button>
      </div>
    </motion.article>
  );
}

// ---------------------------------------------------------------------------
// Assinatura vigente
// ---------------------------------------------------------------------------

const STATUS_TEXT: Record<string, { label: string; tone: string }> = {
  active: { label: "Ativa", tone: "var(--success)" },
  trialing: { label: "Em período de teste", tone: "var(--navy-500)" },
  past_due: { label: "Pagamento em atraso", tone: "var(--destructive)" },
  unpaid: { label: "Fatura em aberto", tone: "var(--destructive)" },
  paused: { label: "Pausada", tone: "var(--warning)" },
  canceled: { label: "Cancelada", tone: "var(--muted-foreground)" },
};

function CurrentPlan({
  subscription,
  readOnly,
  onManage,
}: {
  subscription: StudentSubscription;
  readOnly: boolean;
  onManage: () => void;
}) {
  const status = STATUS_TEXT[subscription.status] ?? {
    label: subscription.status,
    tone: "var(--muted-foreground)",
  };

  const renews = subscription.currentPeriodEnd
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(
        new Date(subscription.currentPeriodEnd),
      )
    : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-muted/40 px-5 py-4"
    >
      <span
        aria-hidden
        style={{ color: status.tone, backgroundColor: `color-mix(in srgb, ${status.tone} 12%, #ffffff)` }}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
      >
        <CheckIcon className="h-5 w-5" strokeWidth={2.2} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">
          {subscription.planName ?? "Plano contratado"} ·{" "}
          <span style={{ color: status.tone }}>{status.label}</span>
        </p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          {subscription.amountCents !== null &&
            `${formatMoney(subscription.amountCents, subscription.currency)} · `}
          {subscription.cancelAtPeriodEnd
            ? renews
              ? `acesso até ${renews}`
              : "cancelamento agendado"
            : renews
              ? `próxima cobrança em ${renews}`
              : "aguardando confirmação"}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {subscription.hostedInvoiceUrl && (
          <a
            href={subscription.hostedInvoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Última fatura
          </a>
        )}
        <button
          type="button"
          onClick={onManage}
          disabled={readOnly}
          className="rounded-lg border border-border bg-background px-3 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          Gerenciar assinatura
        </button>
      </div>
    </motion.section>
  );
}

function Banner({
  tone,
  icon: Icon,
  children,
}: {
  tone: string;
  icon: typeof CheckIcon;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-5 overflow-hidden"
    >
      <div
        className="flex gap-3 rounded-xl px-4 py-3"
        style={{
          backgroundColor: `color-mix(in srgb, ${tone} 8%, #ffffff)`,
          boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone} 28%, transparent)`,
        }}
      >
        <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: tone }} />
        <p className="text-[13px] leading-relaxed text-foreground/75">{children}</p>
      </div>
    </motion.div>
  );
}
