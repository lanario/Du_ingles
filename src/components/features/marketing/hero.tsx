import { buttonVariants } from "@/components/ui/button";

/**
 * O LCP (headline) renderiza visível de imediato — nada de fade-in aqui.
 * Animar o elemento de maior conteúdo visível é o jeito mais rápido de
 * arruinar o LCP (§7.2).
 */
export function Hero() {
  return (
    <section className="border-b border-border bg-muted/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 md:grid-cols-2 md:items-center md:py-28">
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">
            Escola de inglês
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Aprenda inglês de verdade — no seu ritmo, com professores de verdade.
          </h1>
          <p className="mt-5 max-w-lg text-lg text-muted-foreground">
            Aulas 100% ao vivo, nivelamento pelo padrão internacional CEFR e um método
            pensado para você falar com confiança, não só para passar em prova.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#contato"
              className={buttonVariants("primary", "h-12 px-6 text-base")}
            >
              Agende sua aula experimental
            </a>
            <a href="/login" className={buttonVariants("outline", "h-12 px-6 text-base")}>
              Já sou aluno
            </a>
          </div>
        </div>
        <div className="aspect-[4/3] w-full rounded-xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
      </div>
    </section>
  );
}
