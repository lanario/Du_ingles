const FAQS = [
  {
    q: "Preciso ter algum nível de inglês para começar?",
    a: "Não. Alunos completamente iniciantes começam no nível A1, com aulas pensadas para quem nunca estudou o idioma.",
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

/** <details>/<summary> nativo — acordeão acessível por teclado sem JS extra. */
export function Faq() {
  return (
    <section id="faq" className="border-b border-border bg-muted/30">
      <div className="mx-auto max-w-3xl px-4 py-20">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Perguntas frequentes
        </h2>
        <div className="mt-10 divide-y divide-border rounded-lg border border-border bg-background">
          {FAQS.map((item) => (
            <details key={item.q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                {item.q}
                <span aria-hidden className="text-muted-foreground group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
