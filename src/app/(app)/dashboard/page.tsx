import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { listMyUpcomingSessions } from "@/repositories/class-sessions";
import { listStudentAssignments } from "@/repositories/assignments";
import { getStudentProgress } from "@/repositories/progress";
import { listGroups } from "@/repositories/groups";
import { listLessonPlans } from "@/repositories/lesson-plans";
import { getMyDisplayName } from "@/repositories/users";
import { StudentDashboard } from "@/components/features/dashboard/student-dashboard";
import { TeacherDashboard } from "@/components/features/dashboard/teacher-dashboard";

export const metadata: Metadata = { title: "Início" };

/** Painel sempre reflete a agenda e as entregas do momento — nada de cache. */
export const dynamic = "force-dynamic";

function firstNameOf(fullName: string | null, email: string): string {
  const source = fullName?.trim() || email.split("@")[0] || "";
  return source.split(/\s+/)[0] || "aluno";
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export default async function DashboardPage() {
  const ctx = await requireRole(["teacher", "student"]);
  const isTeacher = ctx.effectiveRole === "teacher";

  const [sessions, fullName] = await Promise.all([
    listMyUpcomingSessions(6),
    getMyDisplayName(ctx.userId),
  ]);
  const firstName = firstNameOf(fullName, ctx.email);

  if (isTeacher) {
    const [groups, plans] = await Promise.all([
      listGroups(),
      listLessonPlans(ctx.userId),
    ]);
    const activeGroups = groups.filter((group) => group.isActive);
    const cutoff = Date.now() + SEVEN_DAYS_MS;

    return (
      <TeacherDashboard
        data={{
          firstName,
          sessions: sessions.map((session) => ({
            id: session.id,
            title: session.title,
            groupName: session.groupName,
            scheduledAt: session.scheduledAt,
            durationMinutes: session.durationMinutes,
            status: session.status,
          })),
          groups: activeGroups.map((group) => ({
            id: group.id,
            name: group.name,
            level: group.level,
            enrolledCount: group.enrolledCount,
            maxStudents: group.maxStudents,
          })),
          plans: plans.slice(0, 6).map((plan) => ({
            id: plan.id,
            title: plan.title,
            level: plan.level,
            updatedAt: plan.updatedAt,
          })),
          totalStudents: activeGroups.reduce(
            (sum, group) => sum + group.enrolledCount,
            0,
          ),
          sessionsNext7Days: sessions.filter(
            (session) => new Date(session.scheduledAt).getTime() <= cutoff,
          ).length,
        }}
      />
    );
  }

  const [progress, assignments] = await Promise.all([
    getStudentProgress(ctx.userId),
    listStudentAssignments(ctx.userId),
  ]);

  const openTasks = assignments.filter(
    (task) => task.myStatus === "pending" || task.myStatus === "late",
  );

  const gradedPercents = progress.grades
    .filter((grade) => grade.score !== null && grade.maxScore)
    .map((grade) => (100 * grade.score!) / grade.maxScore!);

  const averageGrade =
    gradedPercents.length > 0
      ? Math.round(
          (gradedPercents.reduce((sum, value) => sum + value, 0) /
            gradedPercents.length) *
            10,
        ) / 10
      : null;

  const overallAttendance =
    progress.groups.length > 0
      ? Math.round(
          (progress.groups.reduce((sum, group) => sum + group.attendanceRate, 0) /
            progress.groups.length) *
            10,
        ) / 10
      : null;

  return (
    <StudentDashboard
      data={{
        firstName,
        currentLevel: progress.currentLevel,
        completedSessions: progress.completedSessions,
        pendingTasks: openTasks.length,
        averageGrade,
        overallAttendance,
        sessions: sessions.map((session) => ({
          id: session.id,
          title: session.title,
          groupName: session.groupName,
          scheduledAt: session.scheduledAt,
          durationMinutes: session.durationMinutes,
        })),
        tasks: openTasks.slice(0, 5).map((task) => ({
          id: task.id,
          title: task.title,
          groupName: task.groupName,
          dueAt: task.dueAt,
          status: task.myStatus ?? "pending",
        })),
        groups: progress.groups,
        grades: progress.grades.slice(0, 5).map((grade) => ({
          title: grade.title,
          groupName: grade.groupName,
          score: grade.score,
          maxScore: grade.maxScore,
        })),
      }}
    />
  );
}
