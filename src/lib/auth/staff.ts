import "server-only";
import { isAdmin, requireRole, type SessionContext } from "@/lib/auth/session";
import { isGroupOwnedByTeacher } from "@/repositories/groups";
import { isStudentOfTeacher } from "@/repositories/enrollments";
import { ADMIN_BASE, TEACHER_BASE } from "@/lib/areas";

/**
 * Autorização das telas que a coordenação e o professor dividem.
 *
 * Os repositórios do painel usam service-role (ignoram RLS), então o par
 * "papel + posse" checado aqui É a autorização real dessas actions. O admin
 * passa em tudo (§3.3: coordenação não tem teto de privilégio); o professor
 * só toca no que é dele — a própria turma, o próprio plano, a própria aula.
 */
export async function requireStaff(): Promise<SessionContext> {
  return requireRole(["admin", "teacher"]);
}

/** Turma do professor logado (ou qualquer uma, se for admin). */
export async function canTouchGroup(
  ctx: SessionContext,
  groupId: string,
): Promise<boolean> {
  if (isAdmin(ctx)) return true;
  return isGroupOwnedByTeacher(groupId, ctx.userId);
}

/** Todas as turmas precisam ser do professor — usado ao criar tarefa em lote. */
export async function canTouchGroups(
  ctx: SessionContext,
  groupIds: string[],
): Promise<boolean> {
  if (isAdmin(ctx)) return true;
  const checks = await Promise.all(
    groupIds.map((groupId) => isGroupOwnedByTeacher(groupId, ctx.userId)),
  );
  return checks.every(Boolean);
}

/** Aluno matriculado numa turma do professor logado. */
export async function canSeeStudent(
  ctx: SessionContext,
  studentId: string,
): Promise<boolean> {
  if (isAdmin(ctx)) return true;
  return isStudentOfTeacher(studentId, ctx.userId);
}

/**
 * Prefixo da área de quem está agindo — para `redirect` depois de criar algo
 * (mandar um professor para `/admin/...` bateria no 403 do middleware).
 */
export function staffBase(ctx: SessionContext): string {
  return isAdmin(ctx) ? ADMIN_BASE : TEACHER_BASE;
}
