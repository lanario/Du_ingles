/**
 * Grade de níveis — o construtor "nível → ritmo → compromisso" da vitrine.
 *
 * A vitrine é vendida em três passos fixos: nível (tier), ritmo (aulas em
 * grupo por semana) e compromisso (periodicidade da cobrança). O catálogo
 * (`student_plans`) continua uma lista plana por baixo — cada combinação é
 * uma linha com `tier` + `weekly_frequency` + `billing_interval` — e este
 * módulo é o vocabulário, os preços-base e o gerador que ligam os três
 * passos ao plano real, tanto na vitrine do aluno quanto no admin.
 *
 * Módulo de `lib`, não de `repositories`: é dado e cálculo puro, sem tocar o
 * banco. A camada de repositório importa daqui (para o gerador do catálogo);
 * o inverso quebraria a hierarquia de camadas.
 */

import type { StudentPlan } from "@/repositories/student-plans";
import type { PlanAccent, PlanInterval, PlanTier, PlanWeeklyFrequency } from "@/schemas/student-plans";

export const TIER_ORDER: PlanTier[] = ["standard", "premium", "elite"];

export const TIER_LABEL: Record<PlanTier, string> = {
  standard: "Standard",
  premium: "Premium",
  elite: "Elite",
};

export const TIER_TAGLINE: Record<PlanTier, string> = {
  standard: "Inglês de verdade",
  premium: "Um nível acima",
  elite: "Para quem precisa de resultado",
};

export const TIER_DESCRIPTION: Record<PlanTier, string> = {
  standard:
    "Para quem quer aprender inglês de verdade, construir uma base sólida e desenvolver confiança para se comunicar. Foco em pronúncia correta, compreensão, conversação e uso natural do idioma através do método Du Inglês.",
  premium:
    "Para quem quer ir além do inglês convencional e acelerar sua evolução. Além das aulas, você recebe uma curadoria especial do seu aprendizado, acompanhamento individual e direcionamento para trabalhar suas principais dificuldades.",
  elite:
    "Para quem precisa do inglês para objetivos específicos, profissionais ou de alta exigência — empresários, profissionais, atletas, exames internacionais, entrevistas, intercâmbio ou mudança de país.",
};

export const TIER_ACCENT: Record<PlanTier, PlanAccent> = {
  standard: "navy",
  premium: "gold",
  elite: "violet",
};

/**
 * Benefícios por nível, cumulativos (Premium herda o Standard, Elite herda o
 * Premium) — é assim que o PDF comercial descreve os três pacotes. O Elite
 * do PDF original incluía "assistir às aulas de outras turmas como ouvinte";
 * a escola decidiu remover essa opção, então ela nunca entra aqui.
 */
const STANDARD_FEATURES = [
  "Aulas ao vivo em grupo, de acordo com o nível do aluno",
  "Acesso à Plataforma Du Inglês",
  "Aulas interativas com edição dos materiais em tempo real",
  "Documentos e materiais autorais para acompanhamento das aulas",
  "Acesso ao chat da própria turma e da Diretoria",
  "Exercícios e atividades de fixação",
];

const PREMIUM_EXTRA_FEATURES = [
  "1 aula individual por semana, com horário agendado",
  "Aulas individuais focadas nas necessidades e dificuldades do aluno",
  "Acompanhamento mais próximo da evolução",
  "Correção de exercícios individuais",
  "Orientações personalizadas de estudo",
  "Acesso a 1 curso completo da plataforma",
];

const ELITE_EXTRA_FEATURES = [
  "2 aulas individuais por semana, inclusive aos finais de semana",
  "Aulas individuais totalmente focadas no objetivo do aluno",
  "Acompanhamento intensivo e personalizado da evolução",
  "Correção de exercícios individuais, personalizados e comentados",
  "Acesso a todos os cursos completos da plataforma",
  "Acesso aos documentos e materiais de todas as turmas",
  "Download dos documentos, materiais e cursos da plataforma",
  "Prioridade na fila para perguntas durante as aulas da própria turma",
  "Chat da própria turma, da Diretoria e do Professor",
];

export function tierFeatures(tier: PlanTier): string[] {
  switch (tier) {
    case "standard":
      return STANDARD_FEATURES;
    case "premium":
      return [...STANDARD_FEATURES, ...PREMIUM_EXTRA_FEATURES];
    case "elite":
      return [...STANDARD_FEATURES, ...PREMIUM_EXTRA_FEATURES, ...ELITE_EXTRA_FEATURES];
  }
}

export const WEEKLY_FREQUENCIES: PlanWeeklyFrequency[] = [1, 2, 3];

export const FREQUENCY_LABEL: Record<PlanWeeklyFrequency, string> = {
  1: "1x por semana",
  2: "2x por semana",
  3: "3x por semana",
};

export const FREQUENCY_TITLE: Record<PlanWeeklyFrequency, string> = {
  1: "Você escolhe o seu ritmo",
  2: "O ritmo ideal para evoluir",
  3: "Respire inglês. Viva o idioma",
};

export const FREQUENCY_TAGLINE: Record<PlanWeeklyFrequency, string> = {
  1: "Para quem quer aprender inglês com consistência, respeitando sua rotina.",
  2: "Para quem quer manter contato constante com o inglês e acelerar o aprendizado.",
  3: "Para quem quer máxima exposição ao inglês e acelerar o processo de aprendizagem.",
};

/** Ritmo em destaque no seletor — o "⭐" do PDF. */
export const RECOMMENDED_FREQUENCY: PlanWeeklyFrequency = 2;

/** Os três eixos de compromisso vendidos pela escola, entre os cinco do enum. */
export type CommitmentInterval = "month" | "semester" | "year";
export const COMMITMENT_INTERVALS: CommitmentInterval[] = ["month", "semester", "year"];

export const COMMITMENT_LABEL: Record<CommitmentInterval, string> = {
  month: "Mensal",
  semester: "Semestral",
  year: "Anual",
};

export const COMMITMENT_TITLE: Record<CommitmentInterval, string> = {
  month: "Comece no seu ritmo",
  semester: "Comprometa-se com sua evolução",
  year: "Transforme o inglês em uma habilidade",
};

export const COMMITMENT_TAGLINE: Record<CommitmentInterval, string> = {
  month: "Flexibilidade para aprender inglês sem compromisso de longo prazo.",
  semester:
    "Mais consistência, mais progresso e uma condição especial para manter seu inglês em evolução.",
  year: "Um ano de consistência para desenvolver confiança, fluência e segurança para usar o inglês de verdade.",
};

/** Desconto sobre o valor mensal equivalente, por compromisso mais longo. */
export const COMMITMENT_DISCOUNT: Partial<Record<CommitmentInterval, number>> = {
  semester: 0.15,
  year: 0.25,
};

/**
 * Preço mensal-base (centavos) por nível × ritmo — a tabela-resumo do PDF
 * comercial. É a partir daqui que semestral e anual são calculados
 * ([[commitmentPriceCents]]); o admin nunca digita esses 27 valores à mão.
 */
export const BASE_MONTHLY_PRICE_CENTS: Record<PlanTier, Record<PlanWeeklyFrequency, number>> = {
  standard: { 1: 24990, 2: 34990, 3: 49990 },
  premium: { 1: 39990, 2: 49990, 3: 69990 },
  elite: { 1: 59990, 2: 74990, 3: 99990 },
};

/** Preço do ciclo inteiro (não o equivalente mensal) para um compromisso. */
export function commitmentPriceCents(
  tier: PlanTier,
  frequency: PlanWeeklyFrequency,
  interval: CommitmentInterval,
): number {
  const monthly = BASE_MONTHLY_PRICE_CENTS[tier][frequency];
  if (interval === "month") return monthly;
  const months = interval === "semester" ? 6 : 12;
  const discount = COMMITMENT_DISCOUNT[interval] ?? 0;
  return Math.round(monthly * months * (1 - discount));
}

/** Quanto o compromisso economiza frente a pagar o mesmo período no mensal. */
export function commitmentSavingsCents(
  tier: PlanTier,
  frequency: PlanWeeklyFrequency,
  interval: CommitmentInterval,
): number {
  if (interval === "month") return 0;
  const months = interval === "semester" ? 6 : 12;
  const monthly = BASE_MONTHLY_PRICE_CENTS[tier][frequency];
  return monthly * months - commitmentPriceCents(tier, frequency, interval);
}

/** Acha, no catálogo já carregado, o plano que corresponde aos três passos. */
export function findTierPlan(
  plans: StudentPlan[],
  tier: PlanTier,
  frequency: PlanWeeklyFrequency,
  interval: CommitmentInterval,
): StudentPlan | null {
  return (
    plans.find(
      (plan) =>
        plan.tier === tier &&
        plan.weeklyFrequency === frequency &&
        plan.billingInterval === interval,
    ) ?? null
  );
}

// ---------------------------------------------------------------------------
// Gerador do catálogo padrão — o botão "Gerar planos do PDF" no admin.
// ---------------------------------------------------------------------------

export interface TierPlanSeed {
  name: string;
  headline: string;
  description: string;
  features: string[];
  priceCents: number;
  billingInterval: PlanInterval;
  tier: PlanTier;
  weeklyFrequency: PlanWeeklyFrequency;
  accent: PlanAccent;
  badge: string | null;
  isFeatured: boolean;
  sortOrder: number;
}

/** Chave que identifica uma combinação nível × ritmo × compromisso. */
export function tierPlanKey(
  tier: PlanTier,
  frequency: PlanWeeklyFrequency,
  interval: CommitmentInterval,
): string {
  return `${tier}:${frequency}:${interval}`;
}

/**
 * As 27 combinações (3 níveis × 3 ritmos × 3 compromissos) prontas para
 * inserir no catálogo, com preço, benefícios e legendas já preenchidos a
 * partir do PDF comercial e do desconto de longo prazo definido para a
 * escola. `skip` filtra combinações que já existem, para o gerador não
 * duplicar planos já publicados.
 */
export function buildTierCatalogSeeds(skip: Set<string> = new Set()): TierPlanSeed[] {
  const seeds: TierPlanSeed[] = [];
  let sortOrder = 0;

  for (const tier of TIER_ORDER) {
    for (const frequency of WEEKLY_FREQUENCIES) {
      for (const interval of COMMITMENT_INTERVALS) {
        sortOrder += 1;
        if (skip.has(tierPlanKey(tier, frequency, interval))) continue;

        seeds.push({
          name: `${TIER_LABEL[tier]} · ${FREQUENCY_LABEL[frequency]} · ${COMMITMENT_LABEL[interval]}`,
          headline: TIER_TAGLINE[tier],
          description: TIER_DESCRIPTION[tier],
          features: tierFeatures(tier),
          priceCents: commitmentPriceCents(tier, frequency, interval),
          billingInterval: interval,
          tier,
          weeklyFrequency: frequency,
          accent: TIER_ACCENT[tier],
          badge:
            frequency === RECOMMENDED_FREQUENCY && tier === "premium" ? "Mais recomendado" : null,
          isFeatured: tier === "premium",
          sortOrder,
        });
      }
    }
  }

  return seeds;
}

export type { PlanTier, PlanWeeklyFrequency };
export type { StudentPlan };
