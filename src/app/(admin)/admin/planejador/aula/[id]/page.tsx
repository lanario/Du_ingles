import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import {
  getPlannerSession,
  listPlannerAttendance,
  listPlannerPlans,
} from "@/repositories/lesson-planner";
import { getLiveSession } from "@/repositories/live-session";
import { LessonRoom } from "@/components/features/admin/planner/live/lesson-room";

export const metadata: Metadata = { title: "Sala de aula · Planejador" };

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Sala de aula do admin. `getLiveSession` lê `teacher_notes` via service-role
 * (a coluna tem o SELECT revogado do papel `authenticated`), então a
 * autorização real desta página é o par requireRole(admin) +
 * `getPlannerSession` filtrando pela organização da sessão.
 */
export default async function SalaDeAulaPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await requireRole(["admin"]);

  const session = await getPlannerSession(id, ctx.organizationId);
  if (!session) notFound();

  const [live, attendance, plans] = await Promise.all([
    getLiveSession(id),
    listPlannerAttendance(id, session.groupId),
    listPlannerPlans(ctx.organizationId),
  ]);
  if (!live) notFound();

  return (
    <LessonRoom session={session} live={live} plans={plans} attendance={attendance} />
  );
}
