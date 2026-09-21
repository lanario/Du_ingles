"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit";
import { disconnectAndCleanup } from "@/lib/google/sync";
import { fail, ok, type ActionResult } from "@/types/action-result";

/**
 * Desconecta o Google Agenda de quem está logado: apaga da agenda dele os
 * eventos que a plataforma criou, revoga o acesso no Google e esquece o token.
 * As aulas no sistema não mudam.
 */
export async function disconnectGoogleAction(): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin", "teacher", "student"]);

  try {
    await disconnectAndCleanup(ctx.userId);
  } catch (error) {
    console.error("[google] falha ao desconectar:", error);
    return fail("INTERNAL_ERROR", "Não foi possível desconectar agora. Tente de novo.");
  }

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "GOOGLE_CALENDAR_DISCONNECTED",
    entityType: "profile",
    entityId: ctx.userId,
  });

  revalidatePath("/", "layout");
  return ok(undefined as never);
}
