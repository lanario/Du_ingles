import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import {
  getPlannerPlan,
  listPlannerGroups,
  listPlannerSessions,
} from "@/repositories/lesson-planner";
import { listUsers } from "@/repositories/users";
import { LessonStudio } from "@/components/features/admin/planner/studio/lesson-studio";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const ctx = await requireRole(["admin"]);
  const plan = await getPlannerPlan(id, ctx.organizationId);
  return { title: plan ? `${plan.title} · Planejador` : "Planejador de aulas" };
}

export default async function PlanoDeAulaPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await requireRole(["admin"]);

  // `getPlannerPlan` roda com service-role: o filtro por organização dentro
  // dele é o que autoriza esta página.
  const plan = await getPlannerPlan(id, ctx.organizationId);
  if (!plan) notFound();

  const [sessions, groups, teachers] = await Promise.all([
    listPlannerSessions(ctx.organizationId),
    listPlannerGroups(ctx.organizationId),
    listUsers(ctx.organizationId, { role: "teacher" }),
  ]);

  return (
    <LessonStudio
      plan={plan}
      sessions={sessions.filter((session) => session.lessonPlanId === plan.id)}
      groups={groups}
      teachers={teachers}
    />
  );
}
