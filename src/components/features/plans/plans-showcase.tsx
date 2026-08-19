"use client";

/**
 * Vitrine de planos do aluno — a tela onde ele escolhe e assina.
 *
 * É a única tela da plataforma que precisa *vender*, e o desenho reflete
 * isso: um plano por coluna, preço grande, benefícios com "✓", e um único
 * botão por cartão. Nada de menu de ações, nada de tabela — a decisão aqui é
 * binária.
 *
 * O alternador mensal/anual não filtra: ele *destaca*. Planos de outra
 * periodicidade continuam visíveis mas recuam — esconder opção de compra é a
 * forma mais rápida de o aluno achar que o plano que ele queria sumiu.
 *
 * Movimento, como no resto da plataforma: GSAP no que é contínuo e ligado à
 * rolagem (brilho que percorre o cartão em destaque, entrada em cascata) e
 * Framer no ciclo de vida do React (troca de aba, hover, estado do botão).
 */

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  openBillingPortalAction,
  startPlanCheckoutAction,
} from "@/actions/student/subscriptions";
import { CheckIcon, ClockIcon, ShieldIcon, SpinnerIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import {
  ACCENT_TONE,
  INTERVAL_LABEL,
  INTERVAL_SUFFIX,
  formatMoney,
  monthlyEquivalentCents,
  seatsLeft,
  splitMoney,
  type StudentPlan,
} from "@/components/features/admin/plans/plans-utils";
import type { StudentSubscription } from "@/repositories/student-subscriptions";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/** Agrupamento do alternador. Trimestral e semestral entram em "outros". */
type Cadence = "month" | "year" | "other";

function cadenceOf(plan: StudentPlan): Cadence {
  if (plan.billingInterval === "month") return "month";
  if (plan.billingInterval === "year") return "year";
  return "other";
}

const CADENCE_LABEL: Record<Cadence, string> = {
  month: "Mensal",
  year: "Anual",
  other: "Outros",
};

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
  const reduceMotion = useReducedMotion();

  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const gridRef = useRef<HTMLDivElement>(null);

  const cadences = useMemo(() => {
    const present = new Set(plans.map(cadenceOf));
    return (["month", "year", "other"] as Cadence[]).filter((item) => present.has(item));
  }, [plans]);

  const [cadence, setCadence] = useState<Cadence>(() => cadences[0] ?? "month");

  useEffect(() => {
    if (cadences.length && !cadences.includes(cadence)) setCadence(cadences[0]!);
  }, [cadences, cadence]);

  // Entrada em cascata dos cartões, disparada pela rolagem. Só transform e
  // opacity — animar largura ou posição aqui causaria layout thrash na grade.
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

  const visible = useMemo(
    () =>
      [...plans].sort((a, b) => {
        // Os da periodicidade escolhida primeiro; dentro de cada grupo, a
        // ordem que o admin definiu na vitrine.
        const aMatch = cadenceOf(a) === cadence ? 0 : 1;
        const bMatch = cadenceOf(b) === cadence ? 0 : 1;
        return aMatch - bMatch || a.sortOrder - b.sortOrder || a.priceCents - b.priceCents;
      }),
    [plans, cadence],
  );

  return (
    <div className="pb-12">
      <header className="max-w-2xl">
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
          Escolha seu plano
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Todos os planos incluem acesso à plataforma, material digital e acompanhamento
          do professor. Você pode trocar ou cancelar quando quiser.
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
        <CurrentPlan
          subscription={subscription}
          readOnly={readOnly}
          onManage={openPortal}
        />
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
          {cadences.length > 1 && (
            <div
              role="group"
              aria-label="Periodicidade"
              className="mt-8 inline-flex items-center gap-1 rounded-xl border border-border bg-background p-1"
            >
              {cadences.map((item) => {
                const active = cadence === item;
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCadence(item)}
                    className={cn(
                      "relative rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="du-vitrine-cadence"
                        aria-hidden
                        className="absolute inset-0 rounded-lg bg-muted shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--gold-500)_32%,transparent)]"
                        transition={
                          reduceMotion
                            ? { duration: 0 }
                            : { type: "spring", stiffness: 480, damping: 38 }
                        }
                      />
                    )}
                    <span className="relative">{CADENCE_LABEL[item]}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div
            ref={gridRef}
            className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          >
            {visible.map((plan) => (
              <ShowcaseCard
                key={plan.id}
                plan={plan}
                dimmed={cadences.length > 1 && cadenceOf(plan) !== cadence}
                current={subscription?.planId === plan.id}
                pending={pendingPlan === plan.id}
                disabled={readOnly || pendingPlan !== null}
                readOnly={readOnly}
                onSubscribe={() => subscribe(plan)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cartão da vitrine
// ---------------------------------------------------------------------------

function ShowcaseCard({
  plan,
  dimmed,
  current,
  pending,
  disabled,
  readOnly,
  onSubscribe,
}: {
  plan: StudentPlan;
  dimmed: boolean;
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
      whileHover={reduceMotion || dimmed ? undefined : { y: -6 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl bg-background p-6 transition-opacity duration-300",
        dimmed && "opacity-55 hover:opacity-100",
      )}
      style={{
        boxShadow: plan.isFeatured
          ? `0 0 0 2px ${tone}, 0 24px 50px -34px ${tone}`
          : "inset 0 0 0 1px var(--border), 0 10px 30px -24px rgba(11,26,51,0.4)",
      }}
    >
      {/* Brilho diagonal que atravessa o cartão em destaque no hover. */}
      {plan.isFeatured && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background: `radial-gradient(120% 70% at 50% -10%, color-mix(in srgb, ${tone} 18%, transparent), transparent 68%)`,
          }}
        />
      )}

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-foreground">{plan.name}</h2>
          {plan.headline && (
            <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
              {plan.headline}
            </p>
          )}
        </div>

        {plan.badge && (
          <span
            style={{
              color: tone,
              backgroundColor: `color-mix(in srgb, ${tone} 12%, #ffffff)`,
              boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone} 34%, transparent)`,
            }}
            className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
          >
            {plan.badge}
          </span>
        )}
      </div>

      <div className="relative mt-5">
        <p className="flex items-baseline gap-1 leading-none text-foreground">
          <span className="text-base font-medium text-muted-foreground">{symbol}</span>
          <span className="text-[40px] font-semibold tabular tracking-tight">{whole}</span>
          <span className="text-lg font-semibold tabular text-muted-foreground">
            ,{fraction}
          </span>
          <span className="text-sm font-medium text-muted-foreground">
            {INTERVAL_SUFFIX[plan.billingInterval]}
          </span>
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
          <span>{INTERVAL_LABEL[plan.billingInterval]}</span>
          {monthly !== null && <span>≈ {formatMoney(monthly, plan.currency)}/mês</span>}
          {plan.trialDays > 0 && (
            <span className="font-medium text-[color:var(--success)]">
              {plan.trialDays} dias grátis
            </span>
          )}
        </div>

        {plan.setupFeeCents > 0 && (
          <p className="mt-1 text-[12px] text-muted-foreground">
            + {formatMoney(plan.setupFeeCents, plan.currency)} de matrícula, uma única vez
          </p>
        )}
      </div>

      {plan.features.length > 0 && (
        <ul className="relative mt-5 space-y-2.5">
          {plan.features.map((feature) => (
            <li
              key={feature}
              className="flex items-start gap-2.5 text-[13px] leading-snug text-foreground/75"
            >
              <span
                aria-hidden
                style={{
                  color: tone,
                  backgroundColor: `color-mix(in srgb, ${tone} 12%, #ffffff)`,
                }}
                className="mt-px grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full"
              >
                <CheckIcon className="h-2.5 w-2.5" strokeWidth={2.8} />
              </span>
              <span className="min-w-0">{feature}</span>
            </li>
          ))}
        </ul>
      )}

      {plan.description && (
        <p className="relative mt-4 text-[12px] leading-relaxed text-muted-foreground">
          {plan.description}
        </p>
      )}

      <div className="relative mt-auto pt-6">
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
            "inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed",
            current
              ? "bg-muted text-muted-foreground"
              : soldOut
                ? "bg-muted text-muted-foreground/60"
                : plan.isFeatured
                  ? "text-white hover:opacity-90 disabled:opacity-50"
                  : "border border-border text-foreground hover:bg-muted disabled:opacity-50",
          )}
          style={
            plan.isFeatured && !current && !soldOut
              ? { background: `linear-gradient(100deg, var(--navy-800), ${tone})` }
              : undefined
          }
        >
          {pending && <SpinnerIcon className="h-4 w-4 animate-spin" />}
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

        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Pagamento seguro via Stripe · cancele quando quiser
        </p>
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
