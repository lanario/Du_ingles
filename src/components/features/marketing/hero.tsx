import { DashboardPreview } from "@/components/features/marketing/dashboard-preview";
import { LiveClassCta } from "@/components/features/marketing/live-class-cta";

/**
 * O LCP (headline) renderiza visível de imediato — nada de fade-in aqui.
 * Animar o elemento de maior conteúdo visível é o jeito mais rápido de
 * arruinar o LCP (§7.2).
 */
export function Hero() {
  return (
    <section className="relative">
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
            <a href="#faq" className="btn-cta-fill h-12 px-6 text-base uppercase tracking-wide">
              Comece a falar agora: agende sua aula grátis
            </a>
          </div>
        </div>
        <div className="relative">
          <DashboardPreview />
          <LiveClassCta />
        </div>
      </div>
    </section>
  );
}
