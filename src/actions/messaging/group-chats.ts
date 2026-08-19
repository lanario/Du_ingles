"use server";

import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";
import { sendMessageSchema, togglePostingSchema } from "@/schemas/messaging";
import {
  canModerateChat,
  getChatPostingState,
  getMessageOwner,
  isChatParticipant,
  setStudentsCanPost,
  softDeleteMessage,
} from "@/repositories/group-chats";
import { fail, ok, type ActionResult } from "@/types/action-result";

/**
 * Escritas do chat de turma.
 *
 * A RLS já barra o que precisa ser barrado (participante, trava de postagem),
 * mas as checagens aparecem aqui de novo de propósito: sem elas o usuário
 * receberia um erro genérico de banco em vez de uma frase que explica o que
 * aconteceu — e o `redirect`/`revalidatePath` rodaria em cima de uma escrita
 * que não ocorreu.
 */

/** Mensagem só existe depois de ser aceita pelo banco — nada de eco otimista aqui. */
export async function sendChatMessageAction(
  conversationId: string,
  _prev: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never>> {
  const ctx = await getSessionContext();
  if (!ctx) return fail("UNAUTHENTICATED", "Sessão expirada.");
  if (ctx.isViewAs) {
    return fail("READ_ONLY_MODE", "Modo “ver como” é somente leitura.");
  }

  const parsed = sendMessageSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Escreva uma mensagem.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const participant = await isChatParticipant(conversationId, ctx.userId);
  if (!participant && ctx.realRole !== "admin") {
    return fail("FORBIDDEN", "Você não participa desta turma.");
  }

  const state = await getChatPostingState(conversationId);
  if (!state) return fail("NOT_FOUND", "Conversa não encontrada.");

  if (!state.studentsCanPost && ctx.realRole === "student") {
    return fail("FORBIDDEN", "O professor desativou as mensagens dos alunos.");
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

  return ok(undefined as never);
}

/**
 * Abre/fecha o chat para os alunos da turma. É a única escrita do chat que
 * um aluno nunca pode disparar, então a checagem de moderação vem antes de
 * qualquer coisa — e é registrada em auditoria: silenciar uma turma é uma
 * decisão que alguém pode precisar explicar depois.
 */
export async function toggleStudentPostingAction(
  conversationId: string,
  allowed: boolean,
): Promise<ActionResult<{ studentsCanPost: boolean }>> {
  const ctx = await getSessionContext();
  if (!ctx) return fail("UNAUTHENTICATED", "Sessão expirada.");
  if (ctx.isViewAs) {
    return fail("READ_ONLY_MODE", "Modo “ver como” é somente leitura.");
  }

  const parsed = togglePostingSchema.safeParse({ conversationId, allowed });
  if (!parsed.success) return fail("VALIDATION_ERROR", "Requisição inválida.");

  const canModerate = await canModerateChat(ctx, conversationId);
  if (!canModerate) {
    return fail("FORBIDDEN", "Só o professor da turma pode mudar isso.");
  }

  const updated = await setStudentsCanPost(conversationId, allowed, ctx.userId);
  if (!updated) return fail("INTERNAL_ERROR", "Falha ao atualizar o chat.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: allowed ? "chat.students_unmuted" : "chat.students_muted",
    entityType: "conversation",
    entityId: conversationId,
  });

  revalidatePath("/mensagens");
  revalidatePath("/admin/mensagens");
  return ok({ studentsCanPost: allowed });
}

/** Apagar: o autor apaga a própria; professor e admin apagam qualquer uma da turma. */
export async function deleteChatMessageAction(
  messageId: string,
): Promise<ActionResult<{ messageId: string }>> {
  const ctx = await getSessionContext();
  if (!ctx) return fail("UNAUTHENTICATED", "Sessão expirada.");
  if (ctx.isViewAs) {
    return fail("READ_ONLY_MODE", "Modo “ver como” é somente leitura.");
  }

  const message = await getMessageOwner(messageId);
  if (!message) return fail("NOT_FOUND", "Mensagem não encontrada.");

  const isAuthor = message.senderId === ctx.userId;
  const canModerate = isAuthor
    ? true
    : await canModerateChat(ctx, message.conversationId);

  if (!canModerate) return fail("FORBIDDEN", "Você não pode apagar esta mensagem.");

  const deleted = await softDeleteMessage(messageId);
  if (!deleted) return fail("INTERNAL_ERROR", "Falha ao apagar a mensagem.");

  return ok({ messageId });
}

/**
 * Marca o chat como lido. Não retorna erro nem bloqueia a interface — é
 * housekeeping do badge de não lidas, disparado ao abrir a conversa.
 */
export async function markChatReadAction(conversationId: string): Promise<void> {
  const ctx = await getSessionContext();
  if (!ctx) return;

  const supabase = await createServerSupabaseClient();
  await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("profile_id", ctx.userId);
}
