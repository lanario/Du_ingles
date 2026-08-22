import { DashboardPreview } from "@/components/features/marketing/dashboard-preview";
import { LiveClassCta } from "@/components/features/marketing/live-class-cta";

/**
 * O LCP (headline) renderiza visível de imediato — nada de fade-in aqui.
 * Animar o elemento de maior conteúdo visível é o jeito mais rápido de
 * arruinar o LCP (§7.2).
 *
 * No celular a ordem é outra: título → CTA → maquete. O visitante decide pelo
 * texto e pelo botão, e a prévia do painel (que no desktop divide a dobra com
 * a headline) vira prova social logo abaixo, sem empurrar o CTA para fora da
 * tela. Daí o `flex-col` com `order` em vez de simplesmente empilhar o grid.
 */
export function Hero() {
  return (
    <section className="relative">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pb-14 pt-8 sm:pt-12 md:grid md:grid-cols-2 md:items-center md:py-28">
        <div className="order-1">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-primary sm:text-sm">
            Escola de inglês
          </p>
          <h1 className="text-[2rem] font-bold leading-[1.12] tracking-tight text-balance sm:text-5xl">
            Aprenda inglês de verdade — no seu ritmo, com professores de verdade.
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground sm:mt-5 sm:text-lg">
            Aulas 100% ao vivo, nivelamento pelo padrão internacional CEFR e um método
            pensado para você falar com confiança, não só para passar em prova.
          </p>

          <div className="mt-7 sm:mt-8">
            <a
              href="#faq"
              className="btn-cta-fill w-full px-6 py-4 text-center text-sm font-semibold uppercase leading-snug tracking-wide sm:h-12 sm:w-auto sm:py-0 sm:text-base"
            >
              Comece a falar agora: agende sua aula grátis
            </a>
          </div>

          {/* Selos de confiança: no celular são a única coisa entre o botão e
              a maquete, e respondem as três objeções imediatas. */}
          <ul className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground sm:mt-6 sm:text-[13px]">
            {[
              "Sem cartão de crédito",
              "Aula ao vivo de verdade",
              "Professor certificado",
            ].map((item) => (
              <li key={item} className="inline-flex items-center gap-1.5">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-gold-500" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative order-2 md:mt-0">
          <DashboardPreview />
          <LiveClassCta />
        </div>
      </div>
    </section>
  );
}
