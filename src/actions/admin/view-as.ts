"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireRole, VIEW_AS_COOKIE } from "@/lib/auth/session";
import { signViewAsToken } from "@/lib/auth/view-as-token";
import { auditLog } from "@/lib/audit";
import { enterViewAsSchema } from "@/schemas/view-as";

const THIRTY_MINUTES_MS = 30 * 60 * 1000;

/**
 * Emite o cookie assinado de "ver como" (§3.3). NUNCA troca o JWT — o admin
 * continua sendo admin para o Postgres/RLS; o cookie só controla o que a UI
 * mostra e é checado em toda Server Action de escrita via `assertNotViewAs`.
 *
 * Usada direto como `action` de `<form>` simples (sem useActionState) — os
 * inputs são hidden fields que a própria UI controla, então uma falha de
 * validação aqui é caso de borda, não input digitado; por isso relança em
 * vez de devolver ActionResult.
 */
export async function enterViewAsModeAction(formData: FormData): Promise<void> {
  const ctx = await requireRole(["admin"]);
  if (ctx.realRole !== "admin") throw new Error("Ação restrita a administradores.");

  const parsed = enterViewAsSchema.safeParse({
    role: formData.get("role"),
    targetUserId: formData.get("targetUserId") || undefined,
  });
  if (!parsed.success) {
    throw new Error("Contexto de visualização inválido.");
  }

  const token = await signViewAsToken({
    role: parsed.data.role,
    targetUserId: parsed.data.targetUserId,
    exp: Date.now() + THIRTY_MINUTES_MS,
  });

  (await cookies()).set(VIEW_AS_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: THIRTY_MINUTES_MS / 1000,
  });

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "VIEW_AS_ENTER",
    entityType: "profile",
    entityId: parsed.data.targetUserId,
    metadata: { role: parsed.data.role },
  });

  redirect("/dashboard");
}

export async function exitViewAsModeAction(): Promise<void> {
  const ctx = await requireRole(["admin"]);

  (await cookies()).delete(VIEW_AS_COOKIE);

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "VIEW_AS_EXIT",
  });

  redirect("/admin");
}
