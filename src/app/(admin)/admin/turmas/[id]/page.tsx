import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { getGroupById } from "@/repositories/groups";
import { listGroupEnrollments } from "@/repositories/enrollments";
import { listGroupSessions } from "@/repositories/class-sessions";
import { listUsers } from "@/repositories/users";
import { EnrollStudentForm } from "@/components/features/admin/groups/enroll-student-form";

export const metadata: Metadata = { title: "Turma" };

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TurmaDetailPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await requireRole(["admin"]);

  const group = await getGroupById(id);
  if (!group) notFound();

  const [enrollments, sessions, students] = await Promise.all([
    listGroupEnrollments(id),
    listGroupSessions(id),
    listUsers(ctx.organizationId, { role: "student" }),
  ]);

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{group.name}</h1>
        <p className="mt-1 text-sm text-admin-foreground/70">
          {group.teacherName} · {group.level} ·{" "}
          {group.courseName ?? "sem curso vinculado"}
        </p>
        <p className="mt-1 text-sm text-admin-foreground/60">
          {group.schedule
            .map((s) => `${WEEKDAYS[s.weekday]} ${s.start}–${s.end}`)
            .join(" · ")}
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-admin-foreground/60">
          Matrículas ({enrollments.filter((e) => e.status === "active").length}/
          {group.maxStudents})
        </h2>
        <EnrollStudentForm
          groupId={group.id}
          enrollments={enrollments}
          students={students}
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-admin-foreground/60">
          Próximas sessões ({sessions.length})
        </h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-admin-foreground/60">
            Nenhuma sessão gerada ainda — confira se a turma tem horários definidos.
          </p>
        ) : (
          <ul className="divide-y divide-admin-border rounded-lg border border-admin-border">
            {sessions.slice(0, 8).map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <span>
                  {new Date(s.scheduledAt).toLocaleString("pt-BR", {
                    weekday: "short",
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="text-admin-foreground/60">{s.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
