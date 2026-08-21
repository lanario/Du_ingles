const TESTIMONIALS = [
  {
    quote:
      "Em oito meses consegui defender minha tese em uma conferência internacional. As aulas ao vivo fizeram toda diferença.",
    name: "Marina Souza",
    role: "Aluna — nível B2",
  },
  {
    quote:
      "Gosto de poder rever o conteúdo de cada aula em PDF depois — ajuda muito a fixar o vocabulário novo.",
    name: "Rafael Lima",
    role: "Aluno — nível B1",
  },
  {
    quote:
      "Troquei de escola três vezes até achar um método que realmente me fizesse falar.",
    name: "Camila Duarte",
    role: "Aluna — nível C1",
  },
];

export function Testimonials() {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          O que dizem nossos alunos
        </h2>
        <div className="mt-12 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4">
          {TESTIMONIALS.map((t) => (
            <figure
              key={t.name}
              className="w-[85%] flex-none snap-start rounded-lg border border-border bg-background p-6 sm:w-[45%] lg:w-[31%]"
            >
              <blockquote className="text-sm text-foreground">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-4 text-sm font-medium">
                {t.name}
                <span className="block font-normal text-muted-foreground">{t.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
