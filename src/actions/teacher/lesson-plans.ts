"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import * as repo from "@/repositories/lesson-plans";
import {
  createLessonPlanSchema,
  updateLessonPlanContentSchema,
  updateLessonPlanMetaSchema,
} from "@/schemas/lesson-plans";
import { fail, ok, type ActionResult } from "@/types/action-result";
import type { Json } from "@/types/database.types";

export async function createLessonPlanAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["teacher"]);

  const parsed = createLessonPlanSchema.safeParse({
    title: formData.get("title"),
    summary: formData.get("summary"),
    level: formData.get("level"),
    durationMinutes: formData.get("durationMinutes") || undefined,
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const result = await repo.createLessonPlan(parsed.data, ctx.organizationId, ctx.userId);
  if (!result.success || !result.id)
    return fail("INTERNAL_ERROR", "Falha ao criar o plano.");

  revalidatePath("/planos-de-aula");
  redirect(`/planos-de-aula/${result.id}`);
}

export async function updateLessonPlanContentAction(
  planId: string,
  formData: FormData,
): Promise<ActionResult<never>> {
  await requireRole(["teacher"]);

  const parsed = updateLessonPlanContentSchema.safeParse({
    content: formData.get("content"),
  });
  if (!parsed.success) return fail("VALIDATION_ERROR", "Conteúdo inválido.");

  let content: Json;
  try {
    content = JSON.parse(parsed.data.content) as Json;
  } catch {
    return fail("VALIDATION_ERROR", "Conteúdo inválido.");
  }

  const success = await repo.updateLessonPlanContent(planId, content);
  if (!success) return fail("INTERNAL_ERROR", "Falha ao salvar.");

  revalidatePath(`/planos-de-aula/${planId}`);
  return ok(undefined as never);
}

export async function updateLessonPlanMetaAction(
  planId: string,
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  await requireRole(["teacher"]);

  const parsed = updateLessonPlanMetaSchema.safeParse({
    title: formData.get("title"),
    summary: formData.get("summary"),
    level: formData.get("level"),
    durationMinutes: formData.get("durationMinutes"),
    isShared: formData.get("isShared") === "on",
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const success = await repo.updateLessonPlanMeta(planId, parsed.data);
  if (!success) return fail("INTERNAL_ERROR", "Falha ao salvar.");

  revalidatePath(`/planos-de-aula/${planId}`);
  return ok(undefined as never);
}

export async function duplicateLessonPlanAction(
  planId: string,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["teacher"]);

  const result = await repo.duplicateLessonPlan(planId, ctx.organizationId, ctx.userId);
  if (!result.success || !result.id) return fail("INTERNAL_ERROR", "Falha ao duplicar.");

  revalidatePath("/planos-de-aula");
  redirect(`/planos-de-aula/${result.id}`);
}

export async function deleteLessonPlanAction(
  planId: string,
): Promise<ActionResult<never>> {
  await requireRole(["teacher"]);

  const success = await repo.deleteLessonPlan(planId);
  if (!success) return fail("INTERNAL_ERROR", "Falha ao excluir.");

  revalidatePath("/planos-de-aula");
  return ok(undefined as never);
}
