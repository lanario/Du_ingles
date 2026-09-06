import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import {
  getPlannerSession,
  listPlannerAttendance,
  listPlannerPlans,
} from "@/repositories/lesson-planner";
import { getLiveSession } from "@/repositories/live-session";
import { getNextSessionPlan } from "@/repositories/class-sessions";
import { AreaProvider, TEACHER_AREA } from "@/components/features/admin/area-context";
import { LessonRoom } from "@/components/features/admin/planner/live/lesson-room";

export const metadata: Metadata = { title: "Sala de aula" };

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Sala de aula do professor. Como no admin, `getLiveSession` lê
 * `teacher_notes` via service-role — a autorização real desta página é o par
 * requireRole(teacher) + a aula ser dele.
 */
export default async function ProfessorSalaDeAulaPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await requireRole(["teacher"]);

  const session = await getPlannerSession(id, ctx.organizationId);
  if (!session || session.teacherId !== ctx.userId) notFound();

  const [live, attendance, plans, nextPlan] = await Promise.all([
    getLiveSession(id),
    listPlannerAttendance(id, session.groupId),
    listPlannerPlans(ctx.organizationId),
    // Só a aula encerrada pergunta pela próxima; nas outras a busca é ruído.
    session.status === "completed" ? getNextSessionPlan(id) : Promise.resolve(null),
  ]);
  if (!live) notFound();

  return (
    <AreaProvider value={TEACHER_AREA}>
      <LessonRoom
        session={session}
        live={live}
        plans={plans.filter((plan) => plan.authorId === ctx.userId || plan.isShared)}
        attendance={attendance}
        nextPlan={nextPlan}
      />
    </AreaProvider>
  );
}
