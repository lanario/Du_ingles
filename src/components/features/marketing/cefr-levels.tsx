"use client";

// Client component: os ícones de cada nível são componentes React e não
// atravessam a fronteira server → client como props.
import { ScrollReveal } from "@/components/motion/scroll-reveal-dynamic";
import { cn } from "@/lib/utils";
import {
  RadialOrbitalTimeline,
  type OrbitalItem,
} from "@/components/ui/radial-orbital-timeline";
import {
  GraduationIcon,
  GroupsIcon,
  MegaphoneIcon,
  MessageIcon,
  ProgressIcon,
  UserIcon,
} from "@/components/ui/icons";

/**
 * Seis níveis em órbita ao redor de um núcleo. A órbita gira sozinha; o
 * clique em um nível para a rotação, traz o nó para a frente e abre o card
 * com o detalhe e os níveis vizinhos. `tone` anda pela escala azul marinho
 * da marca e fecha em dourado no C2: o mesmo acento usado nos CTAs para
 * marcar "o topo" — aqui, o nível mais alto.
 */
const LEVELS: OrbitalItem[] = [
  {
    id: 1,
    code: "A1",
    title: "Iniciante",
    category: "Fundamentos",
    meta: "~80h",
    content: "Frases simples do dia a dia e apresentação pessoal.",
    icon: UserIcon,
    relatedIds: [2],
    energy: 20,
    tone: "var(--navy-300)",
  },
  {
    id: 2,
    code: "A2",
    title: "Básico",
    category: "Fundamentos",
    meta: "~180h",
    content: "Conversas curtas sobre rotina, trabalho e viagens.",
    icon: MessageIcon,
    relatedIds: [1, 3],
    energy: 35,
    tone: "var(--navy-500)",
  },
  {
    id: 3,
    code: "B1",
    title: "Intermediário",
    category: "Independente",
    meta: "~350h",
    content: "Argumenta opiniões e lida com situações inesperadas.",
    icon: GroupsIcon,
    relatedIds: [2, 4],
    energy: 55,
    tone: "var(--navy-600)",
  },
  {
    id: 4,
    code: "B2",
    title: "Intermediário superior",
    category: "Independente",
    meta: "~550h",
    content: "Discute temas complexos com fluência razoável.",
    icon: MegaphoneIcon,
    relatedIds: [3, 5],
    energy: 70,
    tone: "var(--navy-700)",
  },
  {
    id: 5,
    code: "C1",
    title: "Avançado",
    category: "Proficiente",
    meta: "~800h",
    content: "Comunicação fluente em contextos acadêmicos e profissionais.",
    icon: ProgressIcon,
    relatedIds: [4, 6],
    energy: 88,
    tone: "var(--navy-900)",
  },
  {
    id: 6,
    code: "C2",
    title: "Proficiente",
    category: "Domínio",
    meta: "~1.000h",
    content: "Domínio próximo ao de um falante nativo.",
    icon: GraduationIcon,
    relatedIds: [5],
    energy: 100,
    tone: "var(--gold-600)",
  },
];

export function CefrLevels() {
  return (
    <section id="niveis">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Níveis, do A1 ao C2
          </h2>
          <p className="mt-3 text-[15px] text-muted-foreground sm:text-base">
            Seguimos o Quadro Europeu Comum de Referência (CEFR) — o mesmo padrão usado em
            certificações internacionais.
            <span className="hidden md:inline">
              {" "}
              Clique em um nível para ver o detalhe.
            </span>
          </p>
        </div>

        {/* A órbita precisa de raio: abaixo de `md` o anel encolhe até os
            rótulos se sobreporem e o card do nível aberto (256px) sair pela
            borda do contêiner, que é `overflow-hidden`. No celular a mesma
            informação vira uma escada vertical — tudo visível de uma vez,
            sem depender de acertar um alvo de 48px que está girando. */}
        <div className="hidden md:block">
          <ScrollReveal className="mt-10">
            <RadialOrbitalTimeline
              items={LEVELS}
              className="mx-auto h-[520px] w-full max-w-[42rem] sm:h-[600px]"
            />
          </ScrollReveal>
        </div>

        <LevelLadder className="mt-8 md:hidden" />
      </div>
    </section>
  );
}

/**
 * Versão mobile da escala CEFR: uma escada de seis degraus com trilho
 * contínuo à esquerda. O `tone` de cada nível pinta o degrau e a barra de
 * domínio, então a progressão navy → dourado continua legível sem a órbita.
 */
function LevelLadder({ className }: { className?: string }) {
  return (
    <ol className={cn("relative", className)}>
      {/* Trilho: começa e termina no centro dos degraus das pontas. */}
      <span
        aria-hidden
        className="absolute bottom-6 left-[22px] top-6 w-px bg-gradient-to-b from-navy-300 via-navy-500 to-gold-500"
      />

      {LEVELS.map((level) => {
        const Icon = level.icon;
        return (
          <li key={level.id} className="relative flex gap-4 pb-4 last:pb-0">
            <span
              className="relative z-10 mt-0.5 grid h-11 w-11 flex-none place-items-center rounded-full border-2 text-sm font-bold"
              style={{
                color: level.tone,
                backgroundColor: `color-mix(in srgb, ${level.tone} 8%, #ffffff)`,
                borderColor: `color-mix(in srgb, ${level.tone} 45%, transparent)`,
              }}
            >
              {level.code}
            </span>

            <div className="min-w-0 flex-1 rounded-2xl border border-border bg-background/80 p-4 backdrop-blur-sm">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[15px] font-semibold leading-tight text-foreground">
                  {level.title}
                </h3>
                <span className="flex-none text-[11px] text-muted-foreground">
                  {level.meta}
                </span>
              </div>

              <span
                className="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{
                  color: level.tone,
                  backgroundColor: `color-mix(in srgb, ${level.tone} 10%, #ffffff)`,
                }}
              >
                <Icon className="h-3 w-3" />
                {level.category}
              </span>

              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                {level.content}
              </p>

              <div className="mt-3 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${level.energy}%`,
                      background: `linear-gradient(90deg, var(--navy-600), ${level.tone})`,
                    }}
                  />
                </div>
                <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {level.energy}%
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
