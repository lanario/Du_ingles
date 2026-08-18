import { ScrollReveal } from "@/components/motion/scroll-reveal-dynamic";

const PILLARS = [
  {
    title: "Imersão comunicativa",
    description:
      "Você fala inglês desde a primeira aula — o foco é comunicação real, não decoreba de regras.",
  },
  {
    title: "Progresso mensurável",
    description:
      "Nivelamento e evolução seguem o padrão internacional CEFR (A1–C2), com critérios claros a cada etapa.",
  },
  {
    title: "Professores certificados",
    description:
      "Corpo docente formado e experiente, com acompanhamento pedagógico contínuo.",
  },
  {
    title: "Aulas 100% ao vivo",
    description:
      "Nada de vídeo gravado: cada aula é registrada em tempo real e vira material de estudo seu.",
  },
];

export function Methodology() {
  return (
    <section id="metodologia" className="border-b border-border bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Metodologia Du Inglês
          </h2>
          <p className="mt-3 text-muted-foreground">
            Quatro pilares que sustentam cada aula, do primeiro nivelamento até a
            fluência.
          </p>
        </div>
        <ScrollReveal className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((pillar) => (
            <div
              key={pillar.title}
              className="rounded-lg border border-border bg-background p-6"
            >
              <h3 className="font-semibold">{pillar.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{pillar.description}</p>
            </div>
          ))}
        </ScrollReveal>
      </div>
    </section>
  );
}
