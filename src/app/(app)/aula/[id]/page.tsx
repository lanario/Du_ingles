import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { getLiveSession } from "@/repositories/live-session";
import { listSessionAttendance } from "@/repositories/attendance";
import { listLessonPlans } from "@/repositories/lesson-plans";
import { StartSessionForm } from "@/components/features/live-session/start-session-form";
import { LiveSessionEditor } from "@/components/features/live-session/live-session-editor";
import { AttendancePanel } from "@/components/features/live-session/attendance-panel";
import { CompletedSessionView } from "@/components/features/live-session/completed-session-view";

export const metadata: Metadata = { title: "Sala de aula" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AulaPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await requireRole(["teacher"]);

  const session = await getLiveSession(id);
  // getLiveSession usa service-role (ignora RLS) — a checagem de dono
  // AQUI é a única autorização real para esta página.
  if (!session || session.teacherId !== ctx.userId) notFound();

  if (session.status === "scheduled") {
    const plans = await listLessonPlans(ctx.userId);
    return (
      <div>
        <h1 className="text-2xl font-semibold">
          {session.title} · {session.groupName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {new Date(session.scheduledAt).toLocaleString("pt-BR")}
        </p>
        <div className="mt-8">
          <StartSessionForm sessionId={session.id} lessonPlans={plans} />
        </div>
      </div>
    );
  }

  const attendance = await listSessionAttendance(session.id, session.groupId);

  if (session.status === "completed") {
    return (
      <div className="space-y-10">
        <CompletedSessionView session={session} />
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Chamada
          </h2>
          <AttendancePanel
            sessionId={session.id}
            groupId={session.groupId}
            initialRows={attendance}
          />
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <LiveSessionEditor session={session} />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Chamada
        </h2>
        <AttendancePanel
          sessionId={session.id}
          groupId={session.groupId}
          initialRows={attendance}
        />
      </section>
    </div>
  );
}
