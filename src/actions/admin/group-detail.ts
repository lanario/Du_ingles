"use server";

import { isAdmin } from "@/lib/auth/session";
import { canTouchGroup, requireStaff } from "@/lib/auth/staff";
import { getGroupById, type GroupDetail } from "@/repositories/groups";
import { listCourses, type Course } from "@/repositories/courses";
import {
  listActiveEnrollmentRefs,
  listGroupEnrollments,
  type ActiveEnrollmentRef,
  type EnrollmentListItem,
} from "@/repositories/enrollments";
import {
  listGroupSessions,
  type SessionListItem,
  type SessionPreviewItem,
} from "@/repositories/class-sessions";
import { listUsers, type UserListItem } from "@/repositories/users";
import { projectSessions } from "@/lib/schedule/session-preview";

/**
 * Tudo o que a ficha da turma mostra — o mesmo conjunto que
 * `/admin/turmas/[id]` monta no servidor, só que sob demanda.
 *
 * A ficha abre em modal, por cima da lista (ver `group-ficha-modal.tsx`), e a
 * lista entrega só a projeção da turma: matrículas, sessões e o catálogo de
 * alunos não estão lá. Por isso esta leitura existe — é o clique em "Abrir
 * turma" que a dispara, não o carregamento da página.
 */
export interface GroupFicha {
  group: GroupDetail;
  enrollments: EnrollmentListItem[];
  sessions: SessionListItem[];
  previews: SessionPreviewItem[];
  students: UserListItem[];
  courses: Course[];
  /** Só para a coordenação: o professor não reatribui responsável. */
  teachers: UserListItem[];
  activeByStudent: Record<string, ActiveEnrollmentRef>;
  activeCount: number;
}

/**
 * Os repositórios do painel usam service-role, então `canTouchGroup` é a
 * autorização real desta leitura: turma de outro professor devolve `null`, o
 * mesmo que uma turma inexistente — não "acesso negado", que já entregaria a
 * informação de que ela existe.
 */
export async function getGroupFichaAction(groupId: string): Promise<GroupFicha | null> {
  const ctx = await requireStaff();
  if (!(await canTouchGroup(ctx, groupId))) return null;

  const group = await getGroupById(groupId);
  if (!group) return null;

  const [enrollments, sessions, students, courses, teachers, activeByStudent] =
    await Promise.all([
      listGroupEnrollments(groupId),
      listGroupSessions(groupId),
      listUsers(ctx.organizationId, { role: "student" }),
      listCourses(),
      isAdmin(ctx)
        ? listUsers(ctx.organizationId, { role: "teacher" })
        : Promise.resolve([] as UserListItem[]),
      listActiveEnrollmentRefs(ctx.organizationId),
    ]);

  // Prévia: as datas que a grade desenha depois da próxima aula já marcada.
  // Nada disto existe no banco (ver `0035_next_session_only.sql`) — a lista
  // mostra pontilhado, como previsão.
  const previews = projectSessions({
    schedule: group.schedule,
    startDate: group.startDate,
    endDate: group.endDate,
    exclude: sessions.map((session) => session.scheduledAt),
    keyPrefix: group.id,
    limit: 8,
  }).map((item) => ({
    ...item,
    groupId: group.id,
    groupName: group.name,
    title: group.name,
  }));

  return {
    group,
    enrollments,
    sessions,
    previews,
    students,
    courses,
    teachers,
    activeByStudent,
    activeCount: enrollments.filter((item) => item.status === "active").length,
  };
}
