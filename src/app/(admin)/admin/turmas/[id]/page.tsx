import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { getGroupById } from "@/repositories/groups";
import { listCourses } from "@/repositories/courses";
import { listGroupEnrollments } from "@/repositories/enrollments";
import { listGroupSessions } from "@/repositories/class-sessions";
import { listUsers } from "@/repositories/users";
import { GroupHeader } from "@/components/features/admin/groups/group-header";
import { EnrollStudentForm } from "@/components/features/admin/groups/enroll-student-form";
import { GroupSessions } from "@/components/features/admin/groups/group-sessions";
import { SectionTitle } from "@/components/features/admin/dashboard/primitives";

export const metadata: Metadata = { title: "Turma" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TurmaDetailPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await requireRole(["admin"]);

  const group = await getGroupById(id);
  if (!group) notFound();

  const [enrollments, sessions, students, courses, teachers] = await Promise.all([
    listGroupEnrollments(id),
    listGroupSessions(id),
    listUsers(ctx.organizationId, { role: "student" }),
    listCourses(),
    listUsers(ctx.organizationId, { role: "teacher" }),
  ]);

  const activeCount = enrollments.filter((item) => item.status === "active").length;

  return (
    <div className="max-w-5xl space-y-8 pb-10">
      <GroupHeader group={group} courses={courses} teachers={teachers} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <section>
          <SectionTitle hint={`${activeCount}/${group.maxStudents}`}>Matrículas</SectionTitle>
          <EnrollStudentForm
            groupId={group.id}
            enrollments={enrollments}
            students={students}
            seatsLeft={Math.max(0, group.maxStudents - activeCount)}
          />
        </section>

        <section>
          <SectionTitle hint={`${sessions.length} no total`}>Sessões</SectionTitle>
          <GroupSessions sessions={sessions} />
        </section>
      </div>
    </div>
  );
}
