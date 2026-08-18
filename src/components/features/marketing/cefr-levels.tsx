import { ScrollReveal } from "@/components/motion/scroll-reveal-dynamic";

const LEVELS = [
  {
    level: "A1",
    title: "Iniciante",
    description: "Frases simples do dia a dia e apresentação pessoal.",
  },
  {
    level: "A2",
    title: "Básico",
    description: "Conversas curtas sobre rotina, trabalho e viagens.",
  },
  {
    level: "B1",
    title: "Intermediário",
    description: "Argumenta opiniões e lida com situações inesperadas.",
  },
  {
    level: "B2",
    title: "Intermediário superior",
    description: "Discute temas complexos com fluência razoável.",
  },
  {
    level: "C1",
    title: "Avançado",
    description: "Comunicação fluente em contextos acadêmicos e profissionais.",
  },
  {
    level: "C2",
    title: "Proficiente",
    description: "Domínio próximo ao de um falante nativo.",
  },
];

export function CefrLevels() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Níveis, do A1 ao C2
          </h2>
          <p className="mt-3 text-muted-foreground">
            Seguimos o Quadro Europeu Comum de Referência (CEFR) — o mesmo padrão usado em
            certificações internacionais.
          </p>
        </div>
        <ScrollReveal className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LEVELS.map((item) => (
            <div key={item.level} className="rounded-lg border border-border p-5">
              <span className="text-2xl font-bold text-primary">{item.level}</span>
              <h3 className="mt-1 font-semibold">{item.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </ScrollReveal>
      </div>
    </section>
  );
}
