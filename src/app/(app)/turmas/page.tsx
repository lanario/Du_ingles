import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import {
  listAllGroups,
  listGroupsByIds,
  listGroupsByTeacher,
} from "@/repositories/groups";
import {
  listActiveEnrollmentRefs,
  listEnrollmentsForGroups,
  listGroupClassmates,
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

  // "Ver como aluno" mostra a tela do aluno de verdade — só leitura. A gestão
  // completa continua a um clique de distância no seletor de papel; o admin
  // não perde capacidade, só troca a lente.
  if (ctx.effectiveRole !== "student") {
    const isAdmin = ctx.realRole === "admin";
    const [groups, courses, teachers, students, activeByStudent] = await Promise.all([
      isAdmin ? listAllGroups() : listGroupsByTeacher(ctx.userId),
      listCourses(),
      isAdmin ? listUsers(ctx.organizationId, { role: "teacher" }) : Promise.resolve([]),
      listUsers(ctx.organizationId, { role: "student" }),
      listActiveEnrollmentRefs(ctx.organizationId),
    ]);
    const rosters = await listEnrollmentsForGroups(groups.map((group) => group.id));

    return (
      <TeacherGroups
        groups={groups}
        rosters={rosters}
        students={students}
        activeByStudent={activeByStudent}
        courses={courses}
        teachers={isAdmin ? teachers : undefined}
      />
    );
  }

  // Aluno: só as próprias turmas. Nenhuma consulta a turmas de terceiros.
  const enrollments = (await listStudentEnrollments(ctx.userId)).filter(
    (enrollment) => enrollment.status !== "cancelled",
  );
  const groupIds = enrollments.map((enrollment) => enrollment.groupId);
  const [myGroupDetails, classmatesByGroup] = await Promise.all([
    listGroupsByIds(groupIds),
    listGroupClassmates(groupIds),
  ]);

  const byId = new Map(myGroupDetails.map((group) => [group.id, group]));
  const myGroups: StudentGroupView[] = enrollments.flatMap((enrollment) => {
    const group = byId.get(enrollment.groupId);
    if (!group) return [];
    return [
      { group, enrollment, classmates: classmatesByGroup[enrollment.groupId] ?? [] },
    ];
  });

  return <StudentGroups myGroups={myGroups} currentStudentId={ctx.userId} />;
}
