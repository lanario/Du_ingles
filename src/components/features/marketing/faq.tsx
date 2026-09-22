import {
  FaqAccordion,
  type FaqItem,
} from "@/components/features/marketing/faq-accordion";
import Link from "next/link";

const FAQS: FaqItem[] = [
  {
    q: "Preciso ter algum nível de inglês para começar?",
    a: "Não. Alunos completamente iniciantes começam no nível A1, com aulas pensadas para quem nunca estudou o idioma.",
  },
  {
    q: "A aula experimental tem algum custo?",
    a: "Os primeiros 7 dias são uma experiência. Você cadastra o meio de pagamento ao se inscrever, mas só haverá cobrança depois desse período. Se cancelar pela aba Planos antes do fim, não será cobrado.",
  },
  {
    q: "As aulas são gravadas?",
    a: "São. As aulas acontecem ao vivo e ficam gravadas para todos os planos, junto com o PDF do conteúdo, na biblioteca da sua turma — se você faltar, é só assistir depois.",
  },
  {
    q: "Posso mudar de turma ou horário?",
    a: "Sim, entre em contato com a coordenação pelo painel de mensagens para reorganizar sua agenda.",
  },
  {
    q: "Como funciona a avaliação de nível?",
    a: "Um diagnóstico inicial posiciona você num nível CEFR (A1–C2); a evolução é reavaliada periodicamente pelo professor.",
  },
];

/** Como funciona a experiência depois do cadastro. */
const STEPS = [
  {
    title: "Você cria sua conta",
    detail: "Responda às perguntas e escolha o plano que combina com você.",
  },
  {
    title: "Cadastre o pagamento",
    detail: "A primeira cobrança só acontece depois dos 7 dias de experiência.",
  },
  {
    title: "A coordenação combina sua aula",
    detail: "A equipe entra em contato para agendar a aula experimental ao vivo.",
  },
];

/**
 * Bloco de conversão da landing. O cadastro público inicia a experiência de
 * sete dias; esta seção explica as etapas e encaminha para `/cadastro`.
 */
export function Faq() {
  return (
    <section id="faq" className="relative">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <div className="flex flex-col gap-10 lg:grid lg:grid-cols-[1fr_minmax(0,520px)] lg:items-start lg:gap-16">
          <div className="lg:col-start-1 lg:row-start-1 lg:pt-4">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Comece com 7 dias
              <span className="block text-navy-700">para experimentar</span>
            </h2>
            <p className="mt-4 max-w-md text-[15px] text-muted-foreground sm:text-base">
              Crie sua conta, escolha um plano e combine com a coordenação sua aula
              experimental durante o período de experiência.
            </p>
          </div>

          <aside className="rounded-3xl border border-navy-700/20 bg-[linear-gradient(155deg,var(--navy-900),var(--navy-950))] p-6 text-white shadow-[0_24px_60px_-28px_rgba(5,15,34,0.7)] sm:p-8 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-24">
            <span className="inline-flex rounded-full border border-gold-400/40 bg-gold-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-gold-300">
              7 dias de experiência
            </span>
            <h3 className="mt-5 text-2xl font-bold">Sua jornada começa aqui</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              Informe o pagamento com segurança pela Stripe. A primeira cobrança só será
              feita depois dos 7 dias, e você pode cancelar nesse período pela aba Planos.
            </p>
            <Link
              href="/cadastro"
              className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-gold-500 px-5 text-sm font-bold uppercase tracking-wide text-navy-950 transition hover:bg-gold-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Começar meu cadastro
            </Link>
            <p className="mt-3 text-center text-xs text-white/50">
              A coordenação entrará em contato para combinar sua aula experimental.
            </p>
          </aside>

          <div className="lg:col-start-1 lg:row-start-2">
            <ol className="space-y-6">
              {STEPS.map((step, index) => (
                <li key={step.title} className="relative flex gap-4">
                  <span
                    aria-hidden
                    className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-gold-300 bg-gold-50 text-sm font-semibold text-gold-700"
                  >
                    {index + 1}
                  </span>
                  {index < STEPS.length - 1 && (
                    <span
                      aria-hidden
                      className="absolute left-[18px] top-9 h-[calc(100%+0.75rem)] w-px bg-gradient-to-b from-gold-300 to-transparent"
                    />
                  )}
                  <div className="pt-1">
                    <p className="font-medium">{step.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-10 sm:mt-12">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Perguntas frequentes
              </h3>
              <div className="mt-4">
                <FaqAccordion items={FAQS} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
