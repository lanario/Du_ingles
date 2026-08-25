import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { getStudentProgress } from "@/repositories/progress";
import { listStudentAssignments } from "@/repositories/assignments";
import { getActiveSubscriptionFor } from "@/repositories/student-subscriptions";
import { StudentProgressView } from "@/components/features/progress/student-progress-view";

export const metadata: Metadata = { title: "Meu progresso" };

/** Reflete presença e notas em tempo real — nada de cache. */
export const dynamic = "force-dynamic";

function firstNameOf(fullName: string, email: string): string {
  const source = fullName.trim() || email.split("@")[0] || "";
  return source.split(/\s+/)[0] || "aluno";
}

export default async function ProgressoPage() {
  const ctx = await requireRole(["student"]);

  const [progress, assignments, subscription] = await Promise.all([
    getStudentProgress(ctx.userId),
    listStudentAssignments(ctx.userId),
    getActiveSubscriptionFor(ctx.userId),
  ]);

  const pendingTasks = assignments
    .filter((task) => task.myStatus === "pending" || task.myStatus === "late")
    .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));

  const gradedPercents = progress.grades
    .filter((grade) => grade.score !== null && grade.maxScore)
    .map((grade) => (100 * grade.score!) / grade.maxScore!);
  const averageScore =
    gradedPercents.length > 0
      ? Math.round((gradedPercents.reduce((sum, v) => sum + v, 0) / gradedPercents.length) * 10) /
        10
      : null;

  return (
    <StudentProgressView
      firstName={firstNameOf(ctx.fullName, ctx.email)}
      fullName={ctx.fullName}
      email={ctx.email}
      avatarUrl={ctx.avatarUrl}
      currentLevel={progress.currentLevel}
      enrollmentDate={progress.enrollmentDate}
      goals={progress.goals}
      completedSessions={progress.completedSessions}
      overallAttendanceRate={progress.overallAttendanceRate}
      streak={progress.streak}
      groups={progress.groups}
      grades={progress.grades}
      averageScore={averageScore}
      nextSession={progress.nextSession}
      pendingTasks={pendingTasks.map((task) => ({
        id: task.id,
        title: task.title,
        groupName: task.groupName,
        dueAt: task.dueAt,
        status: task.myStatus ?? "pending",
      }))}
      subscription={
        subscription
          ? {
              planName: subscription.planName,
              status: subscription.status,
              currentPeriodEnd: subscription.currentPeriodEnd,
              cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
              trialEnd: subscription.trialEnd,
            }
          : null
      }
    />
  );
}
