import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { listStudents } from "@/repositories/students";
import { listGroupsByTeacher } from "@/repositories/groups";
import { AreaProvider, TEACHER_AREA } from "@/components/features/admin/area-context";
import { StudentsView } from "@/components/features/admin/students/students-view";
import { joinGroups } from "@/components/features/admin/students/students-utils";

export const metadata: Metadata = { title: "Alunos" };

/**
 * "Meus alunos": a mesma tela da coordenação, recortada às turmas deste
 * professor e sem as ações de cadastro. `listStudents` traz a escola inteira
 * (é service-role), então o filtro por matrícula ativa numa turma dele é o
 * que define o que ele enxerga — o resto nem chega ao cliente.
 */
export default async function ProfessorAlunosPage() {
  const ctx = await requireRole(["teacher"]);

  const [allStudents, groups] = await Promise.all([
    listStudents(ctx.organizationId),
    listGroupsByTeacher(ctx.userId),
  ]);

  const myGroupIds = new Set(groups.map((group) => group.id));
  const students = allStudents.filter(
    (student) => student.enrollment && myGroupIds.has(student.enrollment.groupId),
  );

  return (
    <AreaProvider value={TEACHER_AREA}>
      <StudentsView students={joinGroups(students, groups)} groups={groups} />
    </AreaProvider>
  );
}
