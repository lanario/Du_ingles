/**
 * Catálogo padrão sem passo manual.
 *
 * A grade comercial da escola (3 níveis × 3 ritmos × 3 compromissos) não é
 * uma escolha do admin — é o produto que a escola vende. Deixar isso atrás de
 * um botão significava um catálogo vazio até alguém lembrar de clicar; aqui a
 * página de planos garante a grade ao abrir e só então lê a lista.
 *
 * Só completa o que falta: combinações já existentes entram no `skip`, então
 * abrir a página de novo não duplica nada, e um plano apagado de propósito
 * volta na próxima visita — é o mesmo comportamento do gerador antigo.
 *
 * Nada de Stripe aqui. Isto roda durante o render da página, e uma chamada de
 * rede à Stripe por plano transformaria uma abertura de tela em 27 idas à
 * rede. Os planos nascem `draft` e o botão de sincronizar de cada cartão (ou
 * o próprio salvar/publicar) é quem os espelha lá.
 */

import "server-only";
import { buildTierCatalogSeeds, tierPlanKey } from "@/lib/plans/tier-catalog";
import {
  createManyStudentPlans,
  listStudentPlans,
  type StudentPlan,
} from "@/repositories/student-plans";

export async function ensureTierCatalog(
  organizationId: string,
  createdBy: string,
): Promise<StudentPlan[]> {
  const existing = await listStudentPlans(organizationId);

  const skip = new Set(
    existing
      .filter((plan) => plan.tier && plan.weeklyFrequency)
      .map((plan) =>
        tierPlanKey(
          plan.tier!,
          plan.weeklyFrequency!,
          plan.billingInterval as "month" | "semester" | "year",
        ),
      ),
  );

  const seeds = buildTierCatalogSeeds(skip);
  if (seeds.length === 0) return existing;

  const { plans, error } = await createManyStudentPlans(seeds, organizationId, createdBy);

  // Falhar aqui não pode derrubar a página: o admin ainda precisa ver e
  // administrar o que já existe. O log é o que conta o motivo real (uma
  // migration pendente, por exemplo) para quem for investigar.
  if (error) {
    console.error("[ensureTierCatalog] falha ao gerar o catálogo padrão:", error);
    return existing;
  }

  return [...existing, ...plans].sort((a, b) => a.sortOrder - b.sortOrder);
}
