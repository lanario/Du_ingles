import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { listGroupsByTeacher } from "@/repositories/groups";
import { listCourses } from "@/repositories/courses";
import { listEnrollmentsForGroups } from "@/repositories/enrollments";
import { AreaProvider, TEACHER_AREA } from "@/components/features/admin/area-context";
import { TurmasView } from "@/components/features/admin/groups/turmas-view";

export const metadata: Metadata = { title: "Turmas" };

/**
 * Turmas do professor logado — mesma tela da coordenação (cartões, agenda
 * semanal, lotação), limitada às que ele leciona. `teachers` vai vazio de
 * propósito: reatribuir responsável é decisão de coordenação, e sem a lista o
 * seletor nem aparece no painel de edição.
 */
export default async function ProfessorTurmasPage() {
  const ctx = await requireRole(["teacher"]);

  const [groups, courses] = await Promise.all([
    listGroupsByTeacher(ctx.userId),
    listCourses(),
  ]);
  const rosters = await listEnrollmentsForGroups(groups.map((group) => group.id));

  return (
    <AreaProvider value={TEACHER_AREA}>
      <TurmasView groups={groups} courses={courses} teachers={[]} rosters={rosters} />
    </AreaProvider>
  );
}
