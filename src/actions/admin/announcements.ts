"use server";

import { requireRole } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";
import { createAnnouncementSchema } from "@/schemas/announcements";
import { fail, ok, type ActionResult } from "@/types/action-result";

export async function createAnnouncementAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);

  const parsed = createAnnouncementSchema.safeParse({
    scope: formData.get("scope"),
    groupId: formData.get("groupId"),
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos.",
      parsed.error.flatten().fieldErrors,
    );
  }
  if (parsed.data.scope === "group" && !parsed.data.groupId) {
    return fail("VALIDATION_ERROR", "Selecione uma turma.");
  }

  const admin = createAdminSupabaseClient();
  let recipientIds: string[] = [];

  if (parsed.data.scope === "school") {
    const { data } = await admin
      .from("profiles")
      .select("id")
      .eq("organization_id", ctx.organizationId)
      .eq("is_active", true)
      .is("deleted_at", null);
    recipientIds = (data ?? []).map((p) => p.id);
  } else {
    const { data: group } = await admin
      .from("groups")
      .select("teacher_id")
      .eq("id", parsed.data.groupId!)
      .single();
    const { data: enrollments } = await admin
      .from("enrollments")
      .select("student_id")
      .eq("group_id", parsed.data.groupId!)
      .eq("status", "active");
    recipientIds = [
      ...(group ? [group.teacher_id] : []),
      ...(enrollments ?? []).map((e) => e.student_id),
    ];
  }

  if (recipientIds.length === 0) {
    return fail("VALIDATION_ERROR", "Nenhum destinatário encontrado.");
  }

  const { error } = await admin.from("notifications").insert(
    recipientIds.map((recipientId) => ({
      organization_id: ctx.organizationId,
      recipient_id: recipientId,
      type: "announcement",
      title: parsed.data.title,
      body: parsed.data.body,
    })),
  );

  if (error) return fail("INTERNAL_ERROR", "Falha ao enviar o comunicado.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "ANNOUNCEMENT_SEND",
    metadata: {
      scope: parsed.data.scope,
      groupId: parsed.data.groupId ?? null,
      recipients: recipientIds.length,
    },
  });

  return ok(undefined as never);
}
