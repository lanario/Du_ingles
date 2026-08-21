import { CheckIcon } from "@/components/ui/icons";

const PLANS = [
  {
    name: "Basic",
    cycle: "Plano Mensal",
    price: "249",
    currency: "R$",
    period: "/mês",
    description: "Flexibilidade total, sem fidelidade.",
    features: [
      "2 aulas por semana",
      "Material de cada aula em PDF",
      "Suporte por mensagens",
    ],
    highlight: false,
  },
  {
    name: "Pro",
    cycle: "Plano Trimestral",
    price: "219",
    currency: "R$",
    period: "/mês",
    description: "O plano mais escolhido pelos alunos.",
    features: [
      "2 aulas por semana",
      "Material de cada aula em PDF",
      "Suporte por mensagens",
      "Relatório de progresso trimestral",
    ],
    highlight: true,
  },
  {
    name: "Max",
    cycle: "Plano Anual",
    price: "189",
    currency: "R$",
    period: "/mês",
    description: "Melhor custo-benefício para quem já decidiu.",
    features: [
      "2 aulas por semana",
      "Material de cada aula em PDF",
      "Suporte por mensagens",
      "Relatório de progresso trimestral",
      "Certificado de conclusão de nível",
    ],
    highlight: false,
  },
];

/**
 * Seção de preços da landing — cartões escuros no estilo "vitrine premium",
 * sem GlowCard para evitar a borda colorida pelo hover. O layout é inspirado
 * no modelo de referência: badge no topo, nome grande, descrição, preço em
 * destaque, lista de benefícios com check dourado, e botão CTA no rodapé.
 */
export function Pricing() {
  return (
    <section id="planos">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Planos</h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Todos os planos incluem as mesmas aulas ao vivo — o que muda é o
          compromisso e o preço da hora.
        </p>

        <div className="mt-12 grid items-stretch gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <article
              key={plan.name}
              className="pricing-card group relative flex flex-col overflow-hidden rounded-2xl p-6 transition-all duration-300"
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

              {/* Badge do ciclo */}
              <span
                className="mb-4 inline-flex w-fit items-center rounded-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em]"
                style={{
                  color: plan.highlight
                    ? "var(--gold-400)"
                    : "var(--navy-300)",
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
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--navy-300)" }}>
                {plan.description}
              </p>

              {/* Preço */}
              <div className="mt-5 flex items-baseline gap-1">
                <span
                  className="text-sm font-medium"
                  style={{ color: "var(--navy-300)" }}
                >
                  {plan.currency}
                </span>
                <span className="text-[44px] font-bold leading-none tracking-tight text-white">
                  {plan.price}
                </span>
                <span
                  className="text-sm font-medium"
                  style={{ color: "var(--navy-300)" }}
                >
                  {plan.period}
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
                        color: plan.highlight
                          ? "var(--gold-500)"
                          : "var(--gold-400)",
                      }}
                    />
                    <span className="font-medium text-white/80">{f}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <a
                href="#contato"
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-[13px] font-bold uppercase tracking-[0.08em] transition-all duration-200"
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
          ))}
        </div>
      </div>
    </section>
  );
}
