import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { getStudentProgress } from "@/repositories/progress";
import { StudentProgressView } from "@/components/features/progress/student-progress-view";

export const metadata: Metadata = { title: "Meu progresso" };

export default async function ProgressoPage() {
  const ctx = await requireRole(["student"]);
  const progress = await getStudentProgress(ctx.userId);

  return (
    <StudentProgressView
      currentLevel={progress.currentLevel}
      completedSessions={progress.completedSessions}
      groups={progress.groups}
      grades={progress.grades}
    />
  );
}
