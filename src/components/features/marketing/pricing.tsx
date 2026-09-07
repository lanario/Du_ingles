"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { CheckIcon, StarIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import {
  BASE_MONTHLY_PRICE_CENTS,
  FREQUENCY_LABEL,
  RECOMMENDED_FREQUENCY,
  TIER_ACCENT,
  TIER_ORDER,
  TIER_TAGLINE,
  WEEKLY_FREQUENCIES,
  tierFeatures,
} from "@/lib/plans/tier-catalog";
import { ACCENT_TONE } from "@/components/features/admin/plans/plans-utils";
import type { PlanTier, PlanWeeklyFrequency } from "@/schemas/student-plans";

const TIER_NAME: Record<PlanTier, string> = {
  standard: "Standard",
  premium: "Premium",
  elite: "Elite",
};

/**
 * Seção de preços da landing — cartões escuros no estilo "vitrine premium".
 *
 * Diferente da vitrine completa (`/planos`, só depois do cadastro), esta é
 * pública e não fala com o catálogo do banco: os preços vêm direto da tabela
 * comercial (`BASE_MONTHLY_PRICE_CENTS`). Ainda assim é o mesmo construtor
 * nível × ritmo — o visitante troca o ritmo (1x/2x/3x) e já vê o preço de
 * cada nível mudar, e pode marcar o nível que mais combina antes de pedir a
 * aula experimental (o CTA continua levando ao formulário em `#faq`; não há
 * checkout sem conta).
 *
 * O ritmo começa em 1x — o mais barato — de propósito: é a porta de entrada
 * mais convidativa para quem ainda está decidindo, e o 2x (ritmo recomendado
 * internamente) fica marcado com a estrela para quem quiser mais.
 */
export function Pricing() {
  const reduceMotion = useReducedMotion();
  const [frequency, setFrequency] = useState<PlanWeeklyFrequency>(1);
  const [selectedTier, setSelectedTier] = useState<PlanTier | null>(null);

  const pillGroupRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const pillButtonRefs = useRef(new Map<PlanWeeklyFrequency, HTMLButtonElement>());
  const pillMounted = useRef(false);

  const plans = useMemo(
    () =>
      TIER_ORDER.map((tier) => ({
        tier,
        name: TIER_NAME[tier],
        priceCents: BASE_MONTHLY_PRICE_CENTS[tier][frequency],
        description: TIER_TAGLINE[tier],
        features: tierFeatures(tier).slice(0, 4),
        tone: ACCENT_TONE[TIER_ACCENT[tier]],
      })),
    [frequency],
  );

  /**
   * A chave que desliza sob o ritmo ativo é GSAP puro (mede o botão de
   * verdade e faz o tween), não a animação de layout do Framer: o grupo tem
   * três larguras diferentes ("1x" cabe em menos espaço que "3x por semana"),
   * e o `power3.out` do GSAP desliza *e* redimensiona no mesmo gesto sem o
   * solavanco elástico que o spring padrão do Framer daria aqui. O Framer
   * fica com o que é dele: o toque no botão e a estrela do ritmo
   * recomendado aparecendo/sumindo.
   *
   * `x/y/width/height` (não só `x/width`) porque em telas estreitas o grupo
   * pode quebrar para duas linhas — sem a posição vertical a chave prenderia
   * na primeira linha enquanto o botão ativo estivesse na segunda.
   */
  useLayoutEffect(() => {
    const pill = pillRef.current;
    const button = pillButtonRefs.current.get(frequency);
    if (!pill || !button) return;

    const target = {
      x: button.offsetLeft,
      y: button.offsetTop,
      width: button.offsetWidth,
      height: button.offsetHeight,
    };

    if (!pillMounted.current || reduceMotion) {
      gsap.set(pill, target);
    } else {
      gsap.to(pill, { ...target, duration: 0.5, ease: "power3.out" });
    }
    pillMounted.current = true;
  }, [frequency, reduceMotion]);

  // A largura dos botões muda com a fonte carregando e com o grupo
  // quebrando linha em telas estreitas; sem reobservar isso a chave fica
  // desalinhada até o próximo clique.
  useLayoutEffect(() => {
    const group = pillGroupRef.current;
    if (!group || typeof ResizeObserver === "undefined") return;

    const snap = () => {
      const pill = pillRef.current;
      const button = pillButtonRefs.current.get(frequency);
      if (!pill || !button) return;
      gsap.set(pill, {
        x: button.offsetLeft,
        y: button.offsetTop,
        width: button.offsetWidth,
        height: button.offsetHeight,
      });
    };

    const observer = new ResizeObserver(snap);
    observer.observe(group);
    for (const button of pillButtonRefs.current.values()) observer.observe(button);
    document.fonts?.ready.then(snap).catch(() => {});
    return () => observer.disconnect();
  }, [frequency]);

  return (
    <section id="planos">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Planos</h2>
        <p className="mt-3 max-w-2xl text-[15px] text-muted-foreground sm:text-base">
          Três níveis de acompanhamento. Escolha o ritmo das aulas em grupo e já veja o
          preço de cada nível — na vitrine completa dá pra ajustar também o compromisso,
          com condição especial para semestre e ano.
        </p>

        {/* Seletor de ritmo — 1x aparece primeiro e já vem selecionado por
            ser o mais barato; o 2x carrega a estrela do ritmo recomendado.
            Centralizado no container: é a mesma largura da grade de planos
            logo abaixo, então a chave nasce alinhada ao meio dos três
            cartões, não presa à esquerda do parágrafo. */}
        <div className="mt-6 flex justify-center">
          <div
            ref={pillGroupRef}
            role="radiogroup"
            aria-label="Ritmo das aulas por semana"
            className="relative flex flex-wrap justify-center gap-1 rounded-2xl border border-border bg-background p-1 shadow-[var(--shadow-card)]"
          >
            {/* Chave única, deslizada pelo GSAP — ver o efeito acima. */}
            <span
              ref={pillRef}
              aria-hidden
              className="absolute left-0 top-0 z-0 rounded-xl bg-gold-400"
            />

            {WEEKLY_FREQUENCIES.map((item) => {
              const active = frequency === item;
              return (
                <motion.button
                  key={item}
                  ref={(node) => {
                    if (node) pillButtonRefs.current.set(item, node);
                    else pillButtonRefs.current.delete(item);
                  }}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setFrequency(item)}
                  whileTap={reduceMotion ? undefined : { scale: 0.96 }}
                  className={cn(
                    "relative z-10 flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2",
                    active
                      ? "text-navy-950"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {FREQUENCY_LABEL[item]}
                  {item === RECOMMENDED_FREQUENCY && (
                    <StarIcon
                      className="h-3 w-3"
                      fill="currentColor"
                      strokeWidth={0}
                      style={{ color: active ? "var(--navy-950)" : "var(--gold-500)" }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        <p className="mt-4 text-xs text-muted-foreground lg:hidden" aria-hidden>
          Deslize para ver os três planos →
        </p>

        {/* Três cartões empilhados somam ~2.100px de rolagem no celular, e o
            terceiro nunca é visto. Vira um carrossel com `snap` e uma fresta
            do próximo cartão: as margens negativas sangram o trilho até a
            borda da tela para que o `px-4` continue alinhando o primeiro
            cartão com o título. A partir de `lg` é a grade de sempre. */}
        <div className="no-scrollbar -mx-4 mt-8 flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto px-4 pb-4 sm:mt-10 lg:mx-0 lg:mt-12 lg:grid lg:grid-cols-3 lg:gap-6 lg:overflow-visible lg:px-0 lg:pb-0">
          {plans.map((plan) => {
            const whole = Math.floor(plan.priceCents / 100);
            const fraction = String(plan.priceCents % 100).padStart(2, "0");
            const selected = selectedTier === plan.tier;
            // Sem seleção explícita, o Premium continua em destaque — é o que
            // a escola recomenda por padrão.
            const highlighted =
              selected || (selectedTier === null && plan.tier === "premium");

            return (
              <article
                key={plan.name}
                className="pricing-card group relative flex w-[85%] max-w-sm shrink-0 snap-center flex-col overflow-hidden rounded-2xl p-6 transition-all duration-300 sm:w-[62%] lg:w-auto lg:max-w-none"
                style={{
                  background: highlighted
                    ? "linear-gradient(168deg, var(--navy-950) 0%, var(--navy-900) 40%, var(--navy-800) 100%)"
                    : "linear-gradient(168deg, var(--navy-950) 0%, var(--navy-900) 100%)",
                  boxShadow: highlighted
                    ? `inset 0 0 0 1px color-mix(in srgb, ${plan.tone} 32%, transparent), 0 24px 60px -16px rgba(5,15,34,0.7)`
                    : "inset 0 0 0 1px color-mix(in srgb, var(--navy-600) 32%, transparent), 0 16px 40px -20px rgba(5,15,34,0.5)",
                }}
              >
                {/* Brilho sutil no topo do card em destaque */}
                {highlighted && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 -top-px h-px"
                    style={{
                      background: `linear-gradient(90deg, transparent, ${plan.tone}, transparent)`,
                    }}
                  />
                )}

                <div className="flex items-start justify-between gap-2">
                  {/* Badge do ritmo escolhido */}
                  <span
                    className="inline-flex w-fit items-center rounded-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em]"
                    style={{
                      color: highlighted ? plan.tone : "var(--navy-300)",
                      border: `1px solid ${
                        highlighted
                          ? `color-mix(in srgb, ${plan.tone} 32%, transparent)`
                          : "color-mix(in srgb, var(--navy-500) 28%, transparent)"
                      }`,
                      background: highlighted
                        ? `color-mix(in srgb, ${plan.tone} 8%, transparent)`
                        : "color-mix(in srgb, var(--navy-600) 12%, transparent)",
                    }}
                  >
                    {FREQUENCY_LABEL[frequency]}
                  </span>

                  {/* Personalizar: marcar este nível como o plano escolhido */}
                  <button
                    type="button"
                    aria-pressed={selected}
                    aria-label={
                      selected
                        ? `Remover seleção do plano ${plan.name}`
                        : `Selecionar o plano ${plan.name}`
                    }
                    title={selected ? "Plano selecionado" : "Selecionar este plano"}
                    onClick={() => setSelectedTier(selected ? null : plan.tier)}
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950",
                      selected
                        ? "border-transparent"
                        : "border-white/25 hover:border-white/50",
                    )}
                    style={selected ? { backgroundColor: plan.tone } : undefined}
                  >
                    {selected && (
                      <CheckIcon
                        className="h-4 w-4"
                        style={{ color: "var(--navy-950)" }}
                        strokeWidth={3}
                      />
                    )}
                  </button>
                </div>

                {/* Nome do plano */}
                <h3 className="mt-4 text-xl font-bold text-white">{plan.name}</h3>

                {/* Descrição */}
                <p
                  className="mt-1.5 text-sm leading-relaxed"
                  style={{ color: "var(--navy-300)" }}
                >
                  {plan.description}
                </p>

                {/* Preço */}
                <div className="mt-5 flex items-baseline gap-1">
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--navy-300)" }}
                  >
                    R$
                  </span>
                  <span className="text-[44px] font-bold leading-none tracking-tight text-white">
                    {whole}
                  </span>
                  <span
                    className="text-lg font-semibold tabular"
                    style={{ color: "var(--navy-300)" }}
                  >
                    ,{fraction}
                  </span>
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--navy-300)" }}
                  >
                    /mês
                  </span>
                </div>

                {/* Separador */}
                <div
                  className="my-5 h-px w-full"
                  style={{
                    background: highlighted
                      ? `color-mix(in srgb, ${plan.tone} 18%, transparent)`
                      : "color-mix(in srgb, var(--navy-600) 28%, transparent)",
                  }}
                />

                {/* Features */}
                <ul className="flex-1 space-y-3 text-[13px]">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <CheckIcon
                        className="mt-0.5 h-4 w-4 shrink-0"
                        strokeWidth={2.4}
                        style={{ color: highlighted ? plan.tone : "var(--gold-400)" }}
                      />
                      <span className="font-medium text-white/80">{f}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <a
                  href="#faq"
                  className="mt-6 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-[13px] font-bold uppercase tracking-[0.08em] transition-all duration-200"
                  style={{
                    background: highlighted
                      ? plan.tone
                      : "color-mix(in srgb, var(--navy-600) 40%, transparent)",
                    color: highlighted ? "var(--navy-950)" : "white",
                    border: highlighted
                      ? `1px solid ${plan.tone}`
                      : "1px solid color-mix(in srgb, var(--navy-500) 40%, transparent)",
                  }}
                >
                  {selected ? "Continuar com esse plano" : "Quero esse plano"}
                </a>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
