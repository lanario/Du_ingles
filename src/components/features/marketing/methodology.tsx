import Image from "next/image";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";

/**
 * As cinco metodologias que sustentam o plano de aula. Elas aparecem
 * "dentro" da tela do tablet (ContainerScroll), como se o visitante
 * estivesse olhando o roteiro de uma aula de verdade.
 */
const METHODOLOGIES = [
  {
    step: "01",
    title: "Abordagem Comunicativa",
    original: "CLT — Communicative Language Teaching",
    description:
      "A aula inteira gira em torno de comunicação real: você fala desde o primeiro dia, e a gramática entra a serviço do que precisa ser dito.",
    image: "/metodologia/01-comunicativa.webp",
    alt: "Duas pessoas se apresentando em inglês com balões de fala.",
  },
  {
    step: "02",
    title: "Aprendizagem Baseada em Tarefas",
    original: "TBL — Task-Based Learning",
    description:
      "Cada encontro tem uma tarefa concreta — negociar, apresentar, resolver — e o inglês é a ferramenta para concluí-la.",
    image: "/metodologia/02-tarefas.webp",
    alt: "Grupo em volta de um mapa resolvendo uma tarefa com checklist.",
  },
  {
    step: "03",
    title: "Abordagem Lexical",
    original: "Lexical Approach",
    description:
      "O estudo parte de blocos de linguagem (chunks e colocações) em vez de palavras soltas, acelerando a fluência natural.",
    image: "/metodologia/03-lexical.webp",
    alt: "Caderno aberto com blocos de linguagem e colocações em destaque.",
  },
  {
    step: "04",
    title: "Sala de Aula Invertida",
    original: "Flipped Classroom",
    description:
      "O conteúdo novo chega antes da aula pelo material da plataforma; o tempo ao vivo fica reservado para praticar e corrigir.",
    image: "/metodologia/04-invertida.webp",
    alt: "Estudo em casa antes da aula, de um lado, e prática ao vivo com o professor, do outro.",
  },
  {
    step: "05",
    title: "Input Compreensível",
    original: "Natural Approach",
    description:
      "Exposição constante a inglês um passo acima do seu nível, com apoio do professor — é assim que a língua é adquirida, não decorada.",
    image: "/metodologia/05-input.webp",
    alt: "Professora mostrando cartões ilustrados enquanto o aluno escuta em inglês.",
  },
];

export function Methodology() {
  return (
    <section id="metodologia">
      <ContainerScroll
        titleComponent={
          <div className="mx-auto max-w-2xl px-4">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Metodologia Du Inglês
            </h2>
            <p className="mt-3 text-[15px] text-muted-foreground sm:text-base">
              Cinco das metodologias mais eficientes do ensino moderno de inglês,
              combinadas passo a passo em cada aula.
            </p>
          </div>
        }
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 pb-2.5 pt-2 md:px-2 md:pb-3 md:pt-1">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-gold-500" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">
                Plano de aula
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground sm:text-xs">
              CEFR · A1–C2
            </span>
          </div>

          <ol className="flex flex-1 flex-col gap-3 px-2.5 py-3 md:gap-4 md:px-2 md:py-4">
            {METHODOLOGIES.map((item) => (
              <li
                key={item.step}
                className="flex shrink-0 flex-col-reverse gap-3.5 rounded-xl border border-border bg-muted/60 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4 md:gap-6 md:p-6"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4 md:gap-5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground md:h-11 md:w-11 md:text-base">
                    {item.step}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold leading-tight sm:text-base md:text-lg">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-gold-600 sm:text-[11px] md:text-xs">
                      {item.original}
                    </p>
                    <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground sm:text-sm md:text-base">
                      {item.description}
                    </p>
                  </div>
                </div>
                {/* Vinheta da metodologia — as ilustrações são 16:9 e
                    preenchem o quadro sem recorte. No celular ela vem *antes*
                    do texto (`flex-col-reverse`): a ilustração é o que faz
                    parar a rolagem, e o passo numerado logo abaixo dela. */}
                <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg border border-border bg-background sm:w-44 md:w-64">
                  <Image
                    src={item.image}
                    alt={item.alt}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 176px, 256px"
                    className="object-cover"
                  />
                </div>
              </li>
            ))}
          </ol>
        </div>
      </ContainerScroll>
    </section>
  );
}
