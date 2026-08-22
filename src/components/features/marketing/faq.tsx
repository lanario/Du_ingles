import {
  FaqAccordion,
  type FaqItem,
} from "@/components/features/marketing/faq-accordion";
import { TrialClassForm } from "@/components/features/marketing/trial-class-form";

const FAQS: FaqItem[] = [
  {
    q: "Preciso ter algum nível de inglês para começar?",
    a: "Não. Alunos completamente iniciantes começam no nível A1, com aulas pensadas para quem nunca estudou o idioma.",
  },
  {
    q: "A aula experimental tem algum custo?",
    a: "Nenhum. É uma aula ao vivo com professor certificado, mais o diagnóstico do seu nível CEFR — sem cartão e sem compromisso de matrícula.",
  },
  {
    q: "As aulas são gravadas?",
    a: "As aulas são ao vivo. O conteúdo de cada aula fica disponível para você em PDF na sua biblioteca, mas não há vídeo gravado.",
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

/** O que acontece depois do envio — a única pergunta que trava a conversão. */
const STEPS = [
  {
    title: "Você envia o pedido",
    detail: "Cinco campos, menos de um minuto.",
  },
  {
    title: "A coordenação liga",
    detail: "Combinamos dia e horário pelo telefone informado.",
  },
  {
    title: "Você faz a aula ao vivo",
    detail: "Aula real com professor certificado e diagnóstico do seu nível.",
  },
];

/**
 * Bloco de conversão da landing. O formulário da aula experimental ocupa a
 * coluna principal, e as dúvidas frequentes ficam ao lado (empilhadas abaixo
 * no celular) — quem chega até aqui pelo menu "FAQ" continua encontrando as
 * respostas, só que agora com o pedido a um clique de distância, em vez de
 * duas seções abaixo.
 */
export function Faq() {
  return (
    <section id="faq" className="relative">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        {/*
          Uma coluna no celular, duas a partir de `lg`. A ordem muda com o
          tamanho: no celular o formulário sobe para logo depois do título —
          quem chega aqui pelo CTA já decidiu pedir a aula, e empurrar o
          pedido para depois de três passos e cinco perguntas custa conversão.
          Passos e FAQ viram o reforço que vem *depois* do formulário.
        */}
        <div className="flex flex-col gap-10 lg:grid lg:grid-cols-[1fr_minmax(0,520px)] lg:items-start lg:gap-16">
          <div className="lg:col-start-1 lg:row-start-1 lg:pt-4">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Experimente uma aula
              <span className="block text-navy-700">antes de decidir</span>
            </h2>
            <p className="mt-4 max-w-md text-[15px] text-muted-foreground sm:text-base">
              Preencha os dados abaixo e a coordenação entra em contato para agendar sua
              aula experimental gratuita.
            </p>
          </div>

          <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-24">
            <TrialClassForm />
          </div>

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
                  {/* Linha que costura os passos, exceto no último. */}
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
