import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import {
  listPlannerGroups,
  listPlannerPlans,
  listPlannerSessions,
} from "@/repositories/lesson-planner";
import { listOrgAssignments } from "@/repositories/assignments";
import { listUsers } from "@/repositories/users";
import { AreaProvider, TEACHER_AREA } from "@/components/features/admin/area-context";
import { PlannerView } from "@/components/features/admin/planner/planner-view";

export const metadata: Metadata = { title: "Planejador de aulas" };

interface PageProps {
  searchParams: Promise<{ nova?: string }>;
}

/**
 * Planejador do professor. Mesma tela do admin, três recortes:
 *
 * - **Ateliê**: os planos dele mais os que a escola compartilhou — os
 *   compartilhados servem para agendar e duplicar, não para editar (quem
 *   pode editar cada plano é decidido por `editableAuthorId`).
 * - **Agenda**: só as aulas em que ele é o professor.
 * - **Tarefas**: só as das turmas dele.
 */
export default async function ProfessorPlanejadorPage({ searchParams }: PageProps) {
  const ctx = await requireRole(["teacher"]);
  const { nova } = await searchParams;

  const [plans, sessions, allGroups, me, assignments] = await Promise.all([
    listPlannerPlans(ctx.organizationId),
    listPlannerSessions(ctx.organizationId),
    listPlannerGroups(ctx.organizationId),
    listUsers(ctx.organizationId, { role: "teacher" }),
    listOrgAssignments(ctx.organizationId),
  ]);

  const groups = allGroups.filter((group) => group.teacherId === ctx.userId);
  const myGroupIds = new Set(groups.map((group) => group.id));

  return (
    <AreaProvider value={TEACHER_AREA}>
      <PlannerView
        plans={plans.filter((plan) => plan.authorId === ctx.userId || plan.isShared)}
        sessions={sessions.filter((session) => session.teacherId === ctx.userId)}
        groups={groups}
        teachers={me.filter((user) => user.id === ctx.userId)}
        assignments={assignments.filter((item) => myGroupIds.has(item.groupId))}
        editableAuthorId={ctx.userId}
        openCreate={nova !== undefined}
      />
    </AreaProvider>
  );
}
