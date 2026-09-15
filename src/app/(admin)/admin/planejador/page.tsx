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
 * Uma única carga alimenta as duas abas: a escola tem dezenas de planos e
 * algumas centenas de aulas na janela recente, então buscar tudo de uma vez
 * e filtrar em memória é mais barato (e mais rápido para quem usa) do que
 * refazer round-trip a cada filtro.
 */
export default async function PlanejadorPage({ searchParams }: PageProps) {
  const ctx = await requireRole(["admin"]);
  const { nova, tab, pasta, tpasta, filtro } = await searchParams;

  const [
    plans,
    sessions,
    groups,
    teachers,
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

  return (
    <PlannerView
      plans={plans}
      folders={folders}
      sessions={sessions}
      groups={groups}
      teachers={teachers}
      assignments={assignments}
      templates={templates}
      templateFolders={templateFolders}
      openCreate={nova !== undefined}
      initialTab={
        tab && VALID_TABS.has(tab) ? (tab as "atelie" | "agenda" | "tarefas") : undefined
      }
      initialFolderKey={folderKeyFromParam(pasta, folders)}
      initialTaskFolderKey={taskFolderKeyFromParam(tpasta, templateFolders)}
      initialAgendaFilter={
        filtro && VALID_AGENDA_FILTERS.has(filtro)
          ? (filtro as "proximas" | "hoje" | "aovivo" | "concluidas")
          : undefined
      }
    />
  );
}
