"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { findDirectConversation } from "@/repositories/conversations";
import { sendMessageSchema, startConversationSchema } from "@/schemas/messaging";
import { fail, ok, type ActionResult } from "@/types/action-result";

export async function startConversationAction(
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await getSessionContext();
  if (!ctx) return fail("UNAUTHENTICATED", "Sessão expirada.");
  if (ctx.isViewAs)
    return fail("READ_ONLY_MODE", "Modo de visualização é somente leitura.");

  const parsed = startConversationSchema.safeParse({
    contactId: formData.get("contactId"),
  });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Selecione um contato.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const existing = await findDirectConversation(ctx.userId, parsed.data.contactId);
  if (existing) redirect(`/mensagens?c=${existing}`);

  const supabase = await createServerSupabaseClient();
  const { data: conversation, error } = await supabase
    .from("conversations")
    .insert({
      organization_id: ctx.organizationId,
      type: "direct",
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (error || !conversation)
    return fail("INTERNAL_ERROR", "Falha ao iniciar a conversa.");

  const { error: participantsError } = await supabase
    .from("conversation_participants")
    .insert([
      { conversation_id: conversation.id, profile_id: ctx.userId },
      { conversation_id: conversation.id, profile_id: parsed.data.contactId },
    ]);

  if (participantsError) {
    // Provavelmente o trigger `enforce_no_student_to_student_dm` barrou.
    return fail("FORBIDDEN", "Não é possível iniciar essa conversa.");
  }

  redirect(`/mensagens?c=${conversation.id}`);
}

export async function sendMessageAction(
  conversationId: string,
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await getSessionContext();
  if (!ctx) return fail("UNAUTHENTICATED", "Sessão expirada.");
  if (ctx.isViewAs)
    return fail("READ_ONLY_MODE", "Modo de visualização é somente leitura.");

  const parsed = sendMessageSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Escreva uma mensagem.",
      parsed.error.flatten().fieldErrors,
    );
  }

  // 30 mensagens / 5 min por usuário (§8.5).
  const allowed = await checkRateLimit(ctx.userId, "send_message", 30, 300);
  if (!allowed) return fail("RATE_LIMITED", "Muitas mensagens. Aguarde um pouco.");

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("messages").insert({
    organization_id: ctx.organizationId,
    conversation_id: conversationId,
    sender_id: ctx.userId,
    body: parsed.data.body,
  });

  if (error) return fail("INTERNAL_ERROR", "Falha ao enviar a mensagem.");

  revalidatePath("/mensagens");
  return ok(undefined as never);
}

export async function markConversationReadAction(conversationId: string): Promise<void> {
  const ctx = await getSessionContext();
  if (!ctx) return;

  const supabase = await createServerSupabaseClient();
  await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("profile_id", ctx.userId);
}
