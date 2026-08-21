"use client";

// Client component: os ícones de cada nível são componentes React e não
// atravessam a fronteira server → client como props.
import { ScrollReveal } from "@/components/motion/scroll-reveal-dynamic";
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
      <div className="mx-auto max-w-6xl px-4 py-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Níveis, do A1 ao C2
          </h2>
          <p className="mt-3 text-muted-foreground">
            Seguimos o Quadro Europeu Comum de Referência (CEFR) — o mesmo padrão usado em
            certificações internacionais. Clique em um nível para ver o detalhe.
          </p>
        </div>

        <ScrollReveal className="mt-10">
          <RadialOrbitalTimeline
            items={LEVELS}
            className="mx-auto h-[520px] w-full max-w-[42rem] sm:h-[600px]"
          />
        </ScrollReveal>
      </div>
    </section>
  );
}
