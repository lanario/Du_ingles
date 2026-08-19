import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { listAllGroups } from "@/repositories/groups";
import { listCourses } from "@/repositories/courses";
import { listUsers } from "@/repositories/users";
import { listEnrollmentsForGroups } from "@/repositories/enrollments";
import { TurmasView } from "@/components/features/admin/groups/turmas-view";

export const metadata: Metadata = { title: "Turmas" };

interface PageProps {
  searchParams: Promise<{ nova?: string }>;
}

/**
 * `listAllGroups` (e não `listGroups`) porque a tela mostra grade semanal e
 * período junto da lotação — é a mesma query com mais colunas, não uma query
 * a mais por turma.
 */
export default async function TurmasPage({ searchParams }: PageProps) {
  const ctx = await requireRole(["admin"]);
  const { nova } = await searchParams;

  const [groups, courses, teachers] = await Promise.all([
    listAllGroups(),
    listCourses(),
    listUsers(ctx.organizationId, { role: "teacher" }),
  ]);
  const rosters = await listEnrollmentsForGroups(groups.map((group) => group.id));

  return (
    <TurmasView
      groups={groups}
      courses={courses}
      teachers={teachers}
      rosters={rosters}
      openCreate={nova !== undefined}
    />
  );
}
