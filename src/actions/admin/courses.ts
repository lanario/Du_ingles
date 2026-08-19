"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit";
import { createCourse } from "@/repositories/courses";
import { createCourseSchema } from "@/schemas/courses";
import { fail, ok, type ActionResult } from "@/types/action-result";

export async function createCourseAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);

  const parsed = createCourseSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    level: formData.get("level"),
    totalHours: formData.get("totalHours") || undefined,
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const success = await createCourse(parsed.data, ctx.organizationId);
  if (!success) return fail("INTERNAL_ERROR", "Falha ao criar o curso.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "COURSE_CREATE",
    entityType: "course",
  });

  revalidatePath("/admin/cursos");
  return ok(undefined as never);
}
