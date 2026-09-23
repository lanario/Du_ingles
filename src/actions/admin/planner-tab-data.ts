"use server";

import { requireRole } from "@/lib/auth/session";
import {
  listPlannerGroups,
  listPlannerSessions,
  type PlannerGroupOption,
  type PlannerSession,
} from "@/repositories/lesson-planner";
import {
  listAssignmentTemplateFolders,
  listAssignmentTemplates,
  listOrgAssignments,
  type AssignmentTemplateFolder,
  type AssignmentTemplateListItem,
  type PlannerAssignmentListItem,
} from "@/repositories/assignments";
import { listUsers, type UserListItem } from "@/repositories/users";

export async function loadAdminPlannerTabAction(tab: "agenda" | "tarefas") {
  const ctx = await requireRole(["admin"]);

  if (tab === "agenda") {
    const [sessions, groups, teachers] = await Promise.all([
      listPlannerSessions(ctx.organizationId),
      listPlannerGroups(ctx.organizationId),
      listUsers(ctx.organizationId, { role: "teacher" }),
    ]);
    return { tab, sessions, groups, teachers } as {
      tab: "agenda";
      sessions: PlannerSession[];
      groups: PlannerGroupOption[];
      teachers: UserListItem[];
    };
  }

  const [assignments, templates, groups, templateFolders] = await Promise.all([
    listOrgAssignments(ctx.organizationId),
    listAssignmentTemplates(ctx.organizationId),
    listPlannerGroups(ctx.organizationId),
    listAssignmentTemplateFolders(ctx.organizationId, ctx.userId),
  ]);
  return { tab, assignments, templates, groups, templateFolders } as {
    tab: "tarefas";
    assignments: PlannerAssignmentListItem[];
    templates: AssignmentTemplateListItem[];
    groups: PlannerGroupOption[];
    templateFolders: AssignmentTemplateFolder[];
  };
}
