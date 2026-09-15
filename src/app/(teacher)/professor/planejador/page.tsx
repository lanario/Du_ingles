import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import {
  listPlannerFolders,
  listPlannerGroups,
  listPlannerPlans,
  listPlannerSessions,
} from "@/repositories/lesson-planner";
import {
  listAssignmentTemplateFolders,
  listAssignmentTemplates,
  listOrgAssignments,
} from "@/repositories/assignments";
import { listUsers } from "@/repositories/users";
import { AreaProvider, TEACHER_AREA } from "@/components/features/admin/area-context";
import {
  folderKeyFromParam,
  taskFolderKeyFromParam,
} from "@/components/features/admin/planner/planner-utils";
import { PlannerView } from "@/components/features/admin/planner/planner-view";

export const metadata: Metadata = { title: "Planejador de aulas" };

const VALID_TABS = new Set(["atelie", "agenda", "tarefas"]);
const VALID_AGENDA_FILTERS = new Set(["proximas", "hoje", "aovivo", "concluidas"]);

interface PageProps {
  searchParams: Promise<{
    nova?: string;
    tab?: string;
    pasta?: string;
    tpasta?: string;
    filtro?: string;
  }>;
}

/**
 * Planejador do professor. Mesma tela do admin, três recortes:
 *
 * - **Ateliê**: os planos dele mais os que a escola compartilhou — os
 *   compartilhados servem para agendar e duplicar, não para editar (quem
 *   pode editar cada plano é decidido por `editableAuthorId`). O ateliê de
 *   tarefas segue a mesma regra: dele + as compartilhadas pela escola.
 * - **Agenda**: só as aulas em que ele é o professor.
 * - **Tarefas**: só as das turmas dele.
 */
export default async function ProfessorPlanejadorPage({ searchParams }: PageProps) {
  const ctx = await requireRole(["teacher"]);
  const { nova, tab, pasta, tpasta, filtro } = await searchParams;

  const [
    plans,
    sessions,
    allGroups,
    me,
    assignments,
    templates,
    folders,
    templateFolders,
  ] = await Promise.all([
    listPlannerPlans(ctx.organizationId),
    listPlannerSessions(ctx.organizationId),
    listPlannerGroups(ctx.organizationId),
    listUsers(ctx.organizationId, { role: "teacher" }),
    listOrgAssignments(ctx.organizationId),
    listAssignmentTemplates(ctx.organizationId),
    listPlannerFolders(ctx.organizationId, ctx.userId),
    listAssignmentTemplateFolders(ctx.organizationId, ctx.userId),
  ]);

  const groups = allGroups.filter((group) => group.teacherId === ctx.userId);
  const myGroupIds = new Set(groups.map((group) => group.id));

  return (
    <AreaProvider value={TEACHER_AREA}>
      <PlannerView
        plans={plans.filter((plan) => plan.authorId === ctx.userId || plan.isShared)}
        folders={folders}
        sessions={sessions.filter((session) => session.teacherId === ctx.userId)}
        groups={groups}
        teachers={me.filter((user) => user.id === ctx.userId)}
        assignments={assignments.filter((item) => myGroupIds.has(item.groupId))}
        templates={templates.filter(
          (item) => item.ownerId === ctx.userId || item.isShared,
        )}
        templateFolders={templateFolders}
        editableAuthorId={ctx.userId}
        openCreate={nova !== undefined}
        initialTab={
          tab && VALID_TABS.has(tab)
            ? (tab as "atelie" | "agenda" | "tarefas")
            : undefined
        }
        initialFolderKey={folderKeyFromParam(pasta, folders)}
        initialTaskFolderKey={taskFolderKeyFromParam(tpasta, templateFolders)}
        initialAgendaFilter={
          filtro && VALID_AGENDA_FILTERS.has(filtro)
            ? (filtro as "proximas" | "hoje" | "aovivo" | "concluidas")
            : undefined
        }
      />
    </AreaProvider>
  );
}
