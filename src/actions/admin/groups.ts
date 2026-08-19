"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit";
import { createGroup, getGroupById, setGroupActive, updateGroup } from "@/repositories/groups";
import { enrollStudent, unenrollStudent } from "@/repositories/enrollments";
import { createGroupSchema, updateGroupSchema } from "@/schemas/groups";
import { createEnrollmentSchema } from "@/schemas/enrollments";
import { fail, ok, type ActionResult } from "@/types/action-result";

export async function createGroupAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);

  const parsed = createGroupSchema.safeParse({
    name: formData.get("name"),
    courseId: formData.get("courseId"),
    teacherId: formData.get("teacherId"),
    level: formData.get("level"),
    maxStudents: formData.get("maxStudents") || undefined,
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    schedule: formData.get("schedule") || "[]",
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const result = await createGroup(parsed.data, ctx.organizationId);
  if (!result.success)
    return fail("INTERNAL_ERROR", result.message ?? "Falha ao criar turma.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "GROUP_CREATE",
    entityType: "group",
    entityId: result.groupId,
  });

  revalidatePath("/admin/turmas");
  redirect(`/admin/turmas/${result.groupId}`);
}

export async function enrollStudentAction(
  groupId: string,
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);

  const parsed = createEnrollmentSchema.safeParse({
    studentId: formData.get("studentId"),
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Selecione um aluno.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const result = await enrollStudent(groupId, parsed.data.studentId, ctx.organizationId);
  if (!result.success) return fail("CONFLICT", result.message ?? "Falha ao matricular.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "ENROLLMENT_CREATE",
    entityType: "group",
    entityId: groupId,
    metadata: { studentId: parsed.data.studentId },
  });

  revalidatePath(`/admin/turmas/${groupId}`);
  return ok(undefined as never);
}

export async function unenrollStudentAction(
  groupId: string,
  enrollmentId: string,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);

  const success = await unenrollStudent(enrollmentId);
  if (!success) return fail("INTERNAL_ERROR", "Falha ao remover matrícula.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "ENROLLMENT_CANCEL",
    entityType: "group",
    entityId: groupId,
    metadata: { enrollmentId },
  });

  revalidatePath(`/admin/turmas/${groupId}`);
  return ok(undefined as never);
}

/**
 * Edição de turma pelo admin. Espelha a `updateGroupAction` da área logada,
 * mas sem checagem de posse: o admin coordena todas as turmas, então a única
 * regra aqui é o papel.
 *
 * `schedule` só viaja quando o construtor de horários está montado — ausente
 * significa "não mexi na grade", e o repositório usa isso para não regerar
 * sessões já ligadas a planos de aula e presenças.
 */
export async function updateGroupAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);

  const parsed = updateGroupSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    courseId: formData.get("courseId"),
    teacherId: formData.get("teacherId") || undefined,
    level: formData.get("level"),
    maxStudents: formData.get("maxStudents") || undefined,
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    isActive: formData.get("isActive") === "on",
    schedule: formData.has("schedule") ? formData.get("schedule") : undefined,
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const result = await updateGroup(parsed.data);
  if (!result.success)
    return fail("INTERNAL_ERROR", result.message ?? "Falha ao salvar a turma.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "GROUP_UPDATE",
    entityType: "group",
    entityId: parsed.data.id,
  });

  revalidatePath("/admin/turmas");
  revalidatePath(`/admin/turmas/${parsed.data.id}`);
  return ok(undefined as never);
}

/**
 * Remove um horário da grade direto da agenda semanal — sem abrir o painel de
 * edição inteiro. Mesma regra do `ScheduleBuilder`: uma turma sem grade não
 * gera sessões, então não deixa remover o último horário por aqui (o admin
 * que quiser zerar a grade faz isso pelo painel de edição, de propósito).
 */
export async function removeScheduleEntryAction(
  groupId: string,
  entry: { weekday: number; start: string; end: string },
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);

  const group = await getGroupById(groupId);
  if (!group) return fail("NOT_FOUND", "Turma não encontrada.");

  const schedule = group.schedule.filter(
    (e) => !(e.weekday === entry.weekday && e.start === entry.start && e.end === entry.end),
  );
  if (schedule.length === group.schedule.length) {
    return fail("NOT_FOUND", "Horário não encontrado.");
  }
  if (schedule.length === 0) {
    return fail("VALIDATION_ERROR", "A turma precisa de ao menos um horário na grade.");
  }

  const result = await updateGroup({
    id: group.id,
    name: group.name,
    courseId: group.courseId ?? undefined,
    teacherId: group.teacherId,
    level: group.level,
    maxStudents: group.maxStudents,
    startDate: group.startDate ?? undefined,
    endDate: group.endDate ?? undefined,
    isActive: group.isActive,
    schedule,
  });
  if (!result.success)
    return fail("INTERNAL_ERROR", result.message ?? "Falha ao remover o horário.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "GROUP_UPDATE",
    entityType: "group",
    entityId: groupId,
    metadata: { removedScheduleEntry: entry },
  });

  revalidatePath("/admin/turmas");
  revalidatePath(`/admin/turmas/${groupId}`);
  return ok(undefined as never);
}

/**
 * Arquivar/reativar direto do cartão. Desativar esconde a turma da operação
 * do dia a dia sem apagar histórico — as sessões já geradas continuam lá.
 */
export async function setGroupActiveAction(
  groupId: string,
  isActive: boolean,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);

  const success = await setGroupActive(groupId, isActive);
  if (!success) return fail("INTERNAL_ERROR", "Falha ao alterar a turma.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "GROUP_UPDATE",
    entityType: "group",
    entityId: groupId,
    metadata: { isActive },
  });

  revalidatePath("/admin/turmas");
  revalidatePath(`/admin/turmas/${groupId}`);
  return ok(undefined as never);
}
