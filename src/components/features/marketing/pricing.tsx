import { CheckIcon } from "@/components/ui/icons";
import {
  BASE_MONTHLY_PRICE_CENTS,
  RECOMMENDED_FREQUENCY,
  TIER_ORDER,
  TIER_TAGLINE,
  tierFeatures,
} from "@/lib/plans/tier-catalog";

/**
 * Preço no ritmo recomendado (2x/semana), mensal — a mesma referência que a
 * vitrine do aluno usa como ritmo em destaque. Aqui é só a vitrine curta,
 * pública, que convida a pedir a aula-teste; a grade completa (com todos os
 * ritmos e compromissos, e desconto por semestre/ano) só existe depois do
 * cadastro, em `/planos`.
 */
const PLANS = TIER_ORDER.map((tier) => ({
  tier,
  name: tier === "standard" ? "Standard" : tier === "premium" ? "Premium" : "Elite",
  cycle: "2x por semana",
  priceCents: BASE_MONTHLY_PRICE_CENTS[tier][RECOMMENDED_FREQUENCY],
  description: TIER_TAGLINE[tier],
  features: tierFeatures(tier).slice(0, 4),
  highlight: tier === "premium",
}));

/**
 * Seção de preços da landing — cartões escuros no estilo "vitrine premium",
 * sem GlowCard para evitar a borda colorida pelo hover. O layout é inspirado
 * no modelo de referência: badge no topo, nome grande, descrição, preço em
 * destaque, lista de benefícios com check dourado, e botão CTA no rodapé.
 */
export function Pricing() {
  return (
    <section id="planos">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Planos</h2>
        <p className="mt-3 max-w-2xl text-[15px] text-muted-foreground sm:text-base">
          Três níveis de acompanhamento. Preço a partir do ritmo mais escolhido — na
          vitrine completa dá pra ajustar ritmo e compromisso, com condição especial
          para semestre e ano.
        </p>
        <p className="mt-4 text-xs text-muted-foreground lg:hidden" aria-hidden>
          Deslize para ver os três planos →
        </p>

        {/* Três cartões empilhados somam ~2.100px de rolagem no celular, e o
            terceiro nunca é visto. Vira um carrossel com `snap` e uma fresta
            do próximo cartão: as margens negativas sangram o trilho até a
            borda da tela para que o `px-4` continue alinhando o primeiro
            cartão com o título. A partir de `lg` é a grade de sempre. */}
        <div className="no-scrollbar -mx-4 mt-8 flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto px-4 pb-4 sm:mt-10 lg:mx-0 lg:mt-12 lg:grid lg:grid-cols-3 lg:gap-6 lg:overflow-visible lg:px-0 lg:pb-0">
          {PLANS.map((plan) => {
            const whole = Math.floor(plan.priceCents / 100);
            const fraction = String(plan.priceCents % 100).padStart(2, "0");

            return (
              <article
                key={plan.name}
                className="pricing-card group relative flex w-[85%] max-w-sm shrink-0 snap-center flex-col overflow-hidden rounded-2xl p-6 transition-all duration-300 sm:w-[62%] lg:w-auto lg:max-w-none"
                style={{
                  background: plan.highlight
                    ? "linear-gradient(168deg, var(--navy-950) 0%, var(--navy-900) 40%, var(--navy-800) 100%)"
                    : "linear-gradient(168deg, var(--navy-950) 0%, var(--navy-900) 100%)",
                  boxShadow: plan.highlight
                    ? "inset 0 0 0 1px color-mix(in srgb, var(--gold-500) 28%, transparent), 0 24px 60px -16px rgba(5,15,34,0.7)"
                    : "inset 0 0 0 1px color-mix(in srgb, var(--navy-600) 32%, transparent), 0 16px 40px -20px rgba(5,15,34,0.5)",
                }}
              >
                {/* Brilho sutil no topo do card em destaque */}
                {plan.highlight && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 -top-px h-px"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, var(--gold-500), transparent)",
                    }}
                  />
                )}

                {/* Badge do ritmo de referência */}
                <span
                  className="mb-4 inline-flex w-fit items-center rounded-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em]"
                  style={{
                    color: plan.highlight ? "var(--gold-400)" : "var(--navy-300)",
                    border: `1px solid ${
                      plan.highlight
                        ? "color-mix(in srgb, var(--gold-500) 32%, transparent)"
                        : "color-mix(in srgb, var(--navy-500) 28%, transparent)"
                    }`,
                    background: plan.highlight
                      ? "color-mix(in srgb, var(--gold-500) 8%, transparent)"
                      : "color-mix(in srgb, var(--navy-600) 12%, transparent)",
                  }}
                >
                  {plan.cycle}
                </span>

                {/* Nome do plano */}
                <h3 className="text-xl font-bold text-white">{plan.name}</h3>

                {/* Descrição */}
                <p
                  className="mt-1.5 text-sm leading-relaxed"
                  style={{ color: "var(--navy-300)" }}
                >
                  {plan.description}
                </p>

                {/* Preço */}
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-sm font-medium" style={{ color: "var(--navy-300)" }}>
                    R$
                  </span>
                  <span className="text-[44px] font-bold leading-none tracking-tight text-white">
                    {whole}
                  </span>
                  <span className="text-lg font-semibold tabular" style={{ color: "var(--navy-300)" }}>
                    ,{fraction}
                  </span>
                  <span className="text-sm font-medium" style={{ color: "var(--navy-300)" }}>
                    /mês
                  </span>
                </div>

                {/* Separador */}
                <div
                  className="my-5 h-px w-full"
                  style={{
                    background: plan.highlight
                      ? "color-mix(in srgb, var(--gold-500) 18%, transparent)"
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
                        style={{
                          color: plan.highlight ? "var(--gold-500)" : "var(--gold-400)",
                        }}
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
                    background: plan.highlight
                      ? "var(--gold-500)"
                      : "color-mix(in srgb, var(--navy-600) 40%, transparent)",
                    color: plan.highlight ? "var(--navy-950)" : "white",
                    border: plan.highlight
                      ? "1px solid var(--gold-400)"
                      : "1px solid color-mix(in srgb, var(--navy-500) 40%, transparent)",
                  }}
                >
                  Quero esse plano
                </a>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
