import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import {
  getPlannerPlan,
  listPlannerGroups,
  listPlannerSessions,
} from "@/repositories/lesson-planner";
import { listUsers } from "@/repositories/users";
import { AreaProvider, TEACHER_AREA } from "@/components/features/admin/area-context";
import { LessonStudio } from "@/components/features/admin/planner/studio/lesson-studio";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const ctx = await requireRole(["teacher"]);
  const plan = await getPlannerPlan(id, ctx.organizationId);
  return { title: plan ? `${plan.title} · Planejador` : "Planejador de aulas" };
}

/**
 * O plano precisa ser do professor ou estar compartilhado — `getPlannerPlan`
 * só garante que é da mesma escola, e escola inteira não é o recorte dele.
 * Plano compartilhado de outra pessoa abre em leitura (o autosave é recusado
 * na action, que confere a autoria).
 */
export default async function ProfessorPlanoDeAulaPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await requireRole(["teacher"]);

  const plan = await getPlannerPlan(id, ctx.organizationId);
  if (!plan || (plan.authorId !== ctx.userId && !plan.isShared)) notFound();

  const [sessions, allGroups, teachers] = await Promise.all([
    listPlannerSessions(ctx.organizationId),
    listPlannerGroups(ctx.organizationId),
    listUsers(ctx.organizationId, { role: "teacher" }),
  ]);

  return (
    <AreaProvider value={TEACHER_AREA}>
      <LessonStudio
        plan={plan}
        sessions={sessions.filter(
          (session) => session.lessonPlanId === plan.id && session.teacherId === ctx.userId,
        )}
        groups={allGroups.filter((group) => group.teacherId === ctx.userId)}
        teachers={teachers.filter((user) => user.id === ctx.userId)}
        readOnly={plan.authorId !== ctx.userId}
      />
    </AreaProvider>
  );
}
