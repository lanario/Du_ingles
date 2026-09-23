import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { listAssignmentTemplateFolders } from "@/repositories/assignments";
import { listPlannerFolders, listPlannerPlans } from "@/repositories/lesson-planner";
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

/** A aba inicial carrega primeiro; agenda e tarefas são buscadas ao abrir. */
export default async function PlanejadorPage({ searchParams }: PageProps) {
  const ctx = await requireRole(["admin"]);
  const { nova, tab, pasta, tpasta, filtro } = await searchParams;

  const [plans, folders, templateFolders] = await Promise.all([
    listPlannerPlans(ctx.organizationId),
    listPlannerFolders(ctx.organizationId, ctx.userId),
    tpasta && !["todas", "compartilhadas", "privadas", "sem-pasta"].includes(tpasta)
      ? listAssignmentTemplateFolders(ctx.organizationId, ctx.userId)
      : Promise.resolve([]),
  ]);

  return (
    <PlannerView
      plans={plans}
      folders={folders}
      sessions={[]}
      groups={[]}
      teachers={[]}
      assignments={[]}
      templates={[]}
      templateFolders={templateFolders}
      deferTabData
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
