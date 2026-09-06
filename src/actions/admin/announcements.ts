"use server";

import { requireRole } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit";
import * as audience from "@/lib/notifications/audience";
import { notifyAnnouncement } from "@/lib/notifications/events";
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

  // O público é resolvido aqui (e não junto com o envio) porque comunicado
  // sem destinatário é erro de formulário: o admin precisa ver isso na tela.
  const recipients =
    parsed.data.scope === "school"
      ? await audience.orgMembers(ctx.organizationId)
      : [
          ...(await audience.groupStudents(parsed.data.groupId!)),
          ...(await audience
            .groupTeacher(parsed.data.groupId!)
            .then((teacher) => (teacher ? [teacher] : []))),
        ];

  if (recipients.length === 0) {
    return fail("VALIDATION_ERROR", "Nenhum destinatário encontrado.");
  }

  notifyAnnouncement({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    title: parsed.data.title,
    body: parsed.data.body,
    recipients,
  });

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "ANNOUNCEMENT_SEND",
    metadata: {
      scope: parsed.data.scope,
      groupId: parsed.data.groupId ?? null,
      recipients: recipients.length,
    },
  });

  return ok(undefined as never);
}
