import { buttonVariants } from "@/components/ui/button";

const PLANS = [
  {
    name: "Mensal",
    price: "R$ 249",
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
    name: "Trimestral",
    price: "R$ 219",
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
    name: "Anual",
    price: "R$ 189",
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

export function Pricing() {
  return (
    <section id="planos" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Planos</h2>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={
                plan.highlight
                  ? "rounded-xl border-2 border-primary bg-background p-6 shadow-sm"
                  : "rounded-xl border border-border bg-background p-6"
              }
            >
              {plan.highlight && (
                <span className="mb-3 inline-block rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
                  Mais popular
                </span>
              )}
              <h3 className="font-semibold">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
              <p className="mt-4">
                <span className="text-3xl font-bold">{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.period}</span>
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span aria-hidden className="text-primary">
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="#contato"
                className={buttonVariants(
                  plan.highlight ? "primary" : "outline",
                  "mt-6 w-full",
                )}
              >
                Quero esse plano
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
