"use server";

import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/types/action-result";

/**
 * O sino é montado nos dois layouts de shell (`(app)` e `(admin)`), que
 * carregam a lista no servidor. Revalidar só esses dois segmentos mantém o
 * payload do RSC coerente depois de marcar como lida sem invalidar o cache do
 * app inteiro.
 */
function revalidateShells(): void {
  revalidatePath("/dashboard", "layout");
  revalidatePath("/admin", "layout");
}

/**
 * Marca uma notificação como lida. O `eq("recipient_id")` é redundante com a
 * RLS (a policy de update já restringe ao destinatário) — está aqui para que a
 * intenção fique explícita no código e o update falhe rápido, sem depender só
 * da política do banco.
 */
export async function markNotificationReadAction(
  notificationId: string,
): Promise<ActionResult> {
  const ctx = await getSessionContext();
  if (!ctx) return fail("UNAUTHENTICATED", "Sessão expirada. Entre novamente.");

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("recipient_id", ctx.userId)
    .is("read_at", null);

  if (error) return fail("INTERNAL_ERROR", "Não foi possível marcar como lida.");

  revalidateShells();
  return ok(undefined);
}

/** Desfaz a leitura — deixa o item de volta na aba "Não lidas". */
export async function markNotificationUnreadAction(
  notificationId: string,
): Promise<ActionResult> {
  const ctx = await getSessionContext();
  if (!ctx) return fail("UNAUTHENTICATED", "Sessão expirada. Entre novamente.");

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: null })
    .eq("id", notificationId)
    .eq("recipient_id", ctx.userId);

  if (error) return fail("INTERNAL_ERROR", "Não foi possível desfazer a leitura.");

  revalidateShells();
  return ok(undefined);
}

/** Zera a caixa. Devolve quantas linhas foram afetadas para o feedback na UI. */
export async function markAllNotificationsReadAction(): Promise<ActionResult<number>> {
  const ctx = await getSessionContext();
  if (!ctx) return fail("UNAUTHENTICATED", "Sessão expirada. Entre novamente.");

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", ctx.userId)
    .is("read_at", null)
    .select("id");

  if (error) return fail("INTERNAL_ERROR", "Não foi possível marcar todas como lidas.");

  revalidateShells();
  return ok(data?.length ?? 0);
}
