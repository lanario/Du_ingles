import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import {
  listActiveGroups,
  listAllGroups,
  listGroupsByIds,
  listGroupsByTeacher,
} from "@/repositories/groups";
import {
  listEnrollmentsForGroups,
  listStudentEnrollments,
} from "@/repositories/enrollments";
import { listCourses } from "@/repositories/courses";
import { listUsers } from "@/repositories/users";
import { TeacherGroups } from "@/components/features/groups/teacher-groups";
import {
  StudentGroups,
  type StudentGroupView,
} from "@/components/features/groups/student-groups";

export const metadata: Metadata = { title: "Turmas" };

export default async function TurmasPage() {
  const ctx = await requireRole(["teacher", "student"]);

  // O admin vê a gestão completa (todas as turmas da escola, professor
  // reatribuível) sempre — mesmo dentro de um "ver como" professor/aluno.
  // A pré-visualização é uma lente sobre a UI de terceiros; o admin nunca
  // perde a própria capacidade de gerir.
  if (ctx.realRole === "admin") {
    const [groups, courses, teachers, students] = await Promise.all([
      listAllGroups(),
      listCourses(),
      listUsers(ctx.organizationId, { role: "teacher" }),
      listUsers(ctx.organizationId, { role: "student" }),
    ]);
    const rosters = await listEnrollmentsForGroups(groups.map((group) => group.id));

    return (
      <TeacherGroups
        groups={groups}
        rosters={rosters}
        students={students}
        courses={courses}
        teachers={teachers}
      />
    );
  }

  if (ctx.effectiveRole === "teacher") {
    const [groups, courses, students] = await Promise.all([
      listGroupsByTeacher(ctx.userId),
      listCourses(),
      listUsers(ctx.organizationId, { role: "student" }),
    ]);
    const rosters = await listEnrollmentsForGroups(groups.map((group) => group.id));

    return (
      <TeacherGroups
        groups={groups}
        rosters={rosters}
        students={students}
        courses={courses}
      />
    );
  }

  const enrollments = await listStudentEnrollments(ctx.userId);
  const [myGroupDetails, activeGroups] = await Promise.all([
    listGroupsByIds(enrollments.map((enrollment) => enrollment.groupId)),
    listActiveGroups(),
  ]);

  const byId = new Map(myGroupDetails.map((group) => [group.id, group]));
  const myGroups: StudentGroupView[] = enrollments
    .filter((enrollment) => enrollment.status !== "cancelled")
    .flatMap((enrollment) => {
      const group = byId.get(enrollment.groupId);
      return group ? [{ group, enrollment }] : [];
    });

  const mine = new Set(myGroups.map((item) => item.group.id));
  const otherGroups = activeGroups.filter((group) => !mine.has(group.id));

  return <StudentGroups myGroups={myGroups} otherGroups={otherGroups} />;
}
