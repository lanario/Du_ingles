import { ContainerScroll } from "@/components/ui/container-scroll-animation";

/**
 * Os seis pilares que sustentam uma aula da escola. Eles aparecem "dentro" da
 * tela do tablet (ContainerScroll), como se o visitante estivesse olhando o
 * roteiro de uma aula de verdade.
 *
 * A lista era ilustrada (`/metodologia/0X-*.webp`), mas as cinco vinhetas
 * foram desenhadas para os cinco métodos acadêmicos que estavam aqui antes —
 * nenhuma corresponde a estes seis pilares, e faltaria uma sexta. Enquanto as
 * novas ilustrações não existirem, o cartão é só tipografia; a coluna da
 * imagem volta ao layout no dia em que os arquivos entrarem em `public/`.
 */
const METHODOLOGIES = [
  {
    step: "01",
    title: "Módulos pré-definidos",
    tag: "Trilha por nível",
    description:
      "Cada turma tem aulas correspondentes ao seu nível. Alguns módulos são mais longos que outros, conforme o grau de dificuldade e o entendimento da turma.",
  },
  {
    step: "02",
    title: "Intensidade",
    tag: "Você escolhe o ritmo",
    description:
      "Quanto mais aulas a turma tem por semana, mais rápido o módulo é concluído.",
  },
  {
    step: "03",
    title: "Imersão",
    tag: "Role-play e músicas",
    description:
      "Cada módulo tem uma aula imersiva, alternando entre role-play — situações da vida real em inglês, como fazer compras, ir ao shopping ou pedir comida no restaurante — e músicas fáceis e famosas, para exercitar o listening e aprender palavras do cotidiano.",
  },
  {
    step: "04",
    title: "Sistema PPP de ensino",
    tag: "Presentation · Practice · Production",
    description:
      "Durante a aula, um assunto novo é Apresentado; em seguida Praticado, com exercícios que testam o entendimento e a pronúncia ao mesmo tempo; e então Produzido pelos alunos, com desafios de criação de frases e histórias.",
  },
  {
    step: "05",
    title: "Shadowing",
    tag: "Repetição guiada, 3 a 5 vezes",
    description:
      "Durante toda a aula, professor e aluno repetem as palavras juntos de três a cinco vezes, para que a pronúncia fique retida na mente.",
  },
  {
    step: "06",
    title: "Exercícios personalizados",
    tag: "Corrigidos pelo professor",
    description:
      "Exercícios e tarefas feitos sob medida para cada aula e cada turma, realizados na própria plataforma e corrigidos pelo professor.",
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
              Seis pilares que se repetem em toda aula — do módulo que a turma percorre ao
              exercício que o professor corrige.
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
                className="flex shrink-0 items-start gap-3 rounded-xl border border-border bg-muted/60 p-3 sm:gap-4 sm:p-4 md:gap-5 md:p-5"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground md:h-11 md:w-11 md:text-base">
                  {item.step}
                </span>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold leading-tight sm:text-base md:text-lg">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-gold-600 sm:text-[11px] md:text-xs">
                    {item.tag}
                  </p>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground sm:text-sm md:text-[15px]">
                    {item.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </ContainerScroll>
    </section>
  );
}
