import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { getGroupById } from "@/repositories/groups";
import { listCourses } from "@/repositories/courses";
import {
  listActiveEnrollmentRefs,
  listGroupEnrollments,
} from "@/repositories/enrollments";
import { listGroupSessions } from "@/repositories/class-sessions";
import { listUsers } from "@/repositories/users";
import { AreaProvider, TEACHER_AREA } from "@/components/features/admin/area-context";
import { GroupHeader } from "@/components/features/admin/groups/group-header";
import { EnrollStudentForm } from "@/components/features/admin/groups/enroll-student-form";
import { GroupSessions } from "@/components/features/admin/groups/group-sessions";
import { SectionTitle } from "@/components/features/admin/dashboard/primitives";

export const metadata: Metadata = { title: "Turma" };

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * `getGroupById` roda com service-role: a checagem de dono AQUI é a única
 * autorização real desta página. Turma de outro professor devolve 404 —
 * não "acesso negado", que já entregaria a informação de que ela existe.
 */
export default async function ProfessorTurmaDetailPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await requireRole(["teacher"]);

  const group = await getGroupById(id);
  if (!group || group.teacherId !== ctx.userId) notFound();

  const [enrollments, sessions, students, courses, activeByStudent] = await Promise.all([
    listGroupEnrollments(id),
    listGroupSessions(id),
    listUsers(ctx.organizationId, { role: "student" }),
    listCourses(),
    listActiveEnrollmentRefs(ctx.organizationId),
  ]);

  const activeCount = enrollments.filter((item) => item.status === "active").length;

  return (
    <AreaProvider value={TEACHER_AREA}>
      <div className="max-w-5xl space-y-8 pb-10">
        <GroupHeader group={group} courses={courses} teachers={[]} />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <section>
            <SectionTitle hint={`${activeCount}/${group.maxStudents}`}>
              Matrículas
            </SectionTitle>
            <EnrollStudentForm
              groupId={group.id}
              groupName={group.name}
              enrollments={enrollments}
              students={students}
              activeByStudent={activeByStudent}
              seatsLeft={Math.max(0, group.maxStudents - activeCount)}
            />
          </section>

          <section>
            <SectionTitle hint={`${sessions.length} no total`}>Sessões</SectionTitle>
            <GroupSessions sessions={sessions} />
          </section>
        </div>
      </div>
    </AreaProvider>
  );
}
