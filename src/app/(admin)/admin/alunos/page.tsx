import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { listStudents } from "@/repositories/students";
import { listGroups } from "@/repositories/groups";
import { StudentsView } from "@/components/features/admin/students/students-view";
import { joinGroups } from "@/components/features/admin/students/students-utils";
import { listStudentRegistrations } from "@/repositories/student-registrations";

export const metadata: Metadata = { title: "Alunos" };

export default async function AlunosPage() {
  const ctx = await requireRole(["admin"]);

  // As listas são carregadas em paralelo; o nome e o nível da turma atual
  // são resolvidos em memória (`joinGroups`).
  const [students, groups, registrations] = await Promise.all([
    listStudents(ctx.organizationId),
    listGroups(),
    listStudentRegistrations(ctx.organizationId),
  ]);

  return (
    <StudentsView
      students={joinGroups(students, groups)}
      groups={groups}
      registrations={registrations}
    />
  );
}
