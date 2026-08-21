import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import {
  listPlannerGroups,
  listPlannerPlans,
  listPlannerSessions,
} from "@/repositories/lesson-planner";
import { listUsers } from "@/repositories/users";
import { PlannerView } from "@/components/features/admin/planner/planner-view";

export const metadata: Metadata = { title: "Planejador de aulas" };

interface PageProps {
  searchParams: Promise<{ nova?: string }>;
}

/**
 * Uma única carga alimenta as duas abas: a escola tem dezenas de planos e
 * algumas centenas de aulas na janela recente, então buscar tudo de uma vez
 * e filtrar em memória é mais barato (e mais rápido para quem usa) do que
 * refazer round-trip a cada filtro.
 */
export default async function PlanejadorPage({ searchParams }: PageProps) {
  const ctx = await requireRole(["admin"]);
  const { nova } = await searchParams;

  const [plans, sessions, groups, teachers] = await Promise.all([
    listPlannerPlans(ctx.organizationId),
    listPlannerSessions(ctx.organizationId),
    listPlannerGroups(ctx.organizationId),
    listUsers(ctx.organizationId, { role: "teacher" }),
  ]);

  return (
    <PlannerView
      plans={plans}
      sessions={sessions}
      groups={groups}
      teachers={teachers}
      openCreate={nova !== undefined}
    />
  );
}
