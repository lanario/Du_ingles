import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { listStudents } from "@/repositories/students";
import { listGroups } from "@/repositories/groups";
import { StudentsView } from "@/components/features/admin/students/students-view";
import { joinGroups } from "@/components/features/admin/students/students-utils";

export const metadata: Metadata = { title: "Alunos" };

export default async function AlunosPage() {
  const ctx = await requireRole(["admin"]);

  // Duas consultas planas: os alunos e as turmas. O nome e o nível da turma
  // matriculada são resolvidos aqui em memória (`joinGroups`), como a página
  // de Clientes do modelo de referência resolve rede e pasta.
  const [students, groups] = await Promise.all([listStudents(ctx.organizationId), listGroups()]);

  return <StudentsView students={joinGroups(students, groups)} groups={groups} />;
}
