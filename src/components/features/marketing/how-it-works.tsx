import { ScrollReveal } from "@/components/motion/scroll-reveal-dynamic";

const STEPS = [
  {
    step: "1",
    title: "Diagnóstico",
    description:
      "Uma conversa para entender seu nível atual e seus objetivos com o inglês.",
  },
  {
    step: "2",
    title: "Nivelamento",
    description:
      "Você é posicionado num nível CEFR (A1–C2) e numa turma compatível com sua rotina.",
  },
  {
    step: "3",
    title: "Aulas",
    description:
      "Aulas ao vivo, com material próprio gerado a cada encontro e tarefas de reforço.",
  },
  {
    step: "4",
    title: "Certificação",
    description:
      "Ao concluir um nível, você recebe certificado e segue para o próximo desafio.",
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Como funciona</h2>
        <ScrollReveal className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((item) => (
            <div key={item.step} className="relative pl-12">
              <span className="absolute left-0 top-0 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {item.step}
              </span>
              <h3 className="font-semibold">{item.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </ScrollReveal>
      </div>
    </section>
  );
}
