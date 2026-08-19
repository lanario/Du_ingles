import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { SessionContext } from "@/lib/auth/session";
import type { AppRole, CefrLevel } from "@/types/domain";

/**
 * Chat de turma. A conversa em si é mantida pelo banco (gatilhos em `groups`
 * e `enrollments`, migration 0026) — aqui só se lê e se modera.
 *
 * O recorte de quem vê o quê não é reimplementado nesta camada: a RLS já
 * responde "aluno vê o chat da turma dele, professor o das turmas dele,
 * admin o da escola inteira". As checagens abaixo existem para as *escritas*
 * privilegiadas (trancar o chat, apagar mensagem), que passam por
 * service-role e por isso precisam de autorização explícita.
 */

export interface GroupChatSummary {
  conversationId: string;
  groupId: string;
  groupName: string;
  level: CefrLevel;
  isActive: boolean;
  teacherId: string;
  teacherName: string;
  memberCount: number;
  studentsCanPost: boolean;
  lastMessageAt: string | null;
  lastMessageBody: string | null;
  lastMessageSender: string | null;
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: AppRole;
  body: string;
  createdAt: string;
  editedAt: string | null;
  isDeleted: boolean;
}

export interface ChatMember {
  id: string;
  fullName: string;
  role: AppRole;
}

/** Últimas mensagens carregadas de uma vez ao abrir o chat. */
export const MESSAGE_PAGE_SIZE = 120;

/**
 * Todos os chats visíveis para quem está logado, já com prévia da última
 * mensagem e contagem de não lidas — uma chamada só (`group_chat_overview`),
 * nunca uma query por turma (§10.1).
 */
export async function listGroupChats(): Promise<GroupChatSummary[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("group_chat_overview");

  if (error || !data) return [];

  return data.map((row) => ({
    conversationId: row.conversation_id,
    groupId: row.group_id,
    groupName: row.group_name,
    level: row.level,
    isActive: row.is_active,
    teacherId: row.teacher_id,
    teacherName: row.teacher_name,
    memberCount: row.member_count,
    studentsCanPost: row.students_can_post,
    lastMessageAt: row.last_message_at,
    lastMessageBody: row.last_message_body,
    lastMessageSender: row.last_message_sender,
    unreadCount: row.unread_count,
  }));
}

/**
 * Histórico do chat. Vem do banco em ordem decrescente (para o `limit` pegar
 * as mais *recentes*) e é invertido aqui — a tela lê de cima para baixo.
 */
export async function getChatMessages(
  conversationId: string,
  limit = MESSAGE_PAGE_SIZE,
): Promise<ChatMessage[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("messages")
    .select(
      "id, sender_id, body, created_at, edited_at, deleted_at, sender:sender_id(full_name, role)",
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data
    .map((row) => ({
      id: row.id,
      senderId: row.sender_id,
      senderName: row.sender?.full_name ?? "—",
      senderRole: (row.sender?.role ?? "student") as AppRole,
      body: row.body,
      createdAt: row.created_at,
      editedAt: row.edited_at,
      isDeleted: row.deleted_at !== null,
    }))
    .reverse();
}

/** Quem está no chat — alimenta o painel de participantes do cabeçalho. */
export async function listChatMembers(conversationId: string): Promise<ChatMember[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("conversation_participants")
    .select("profile:profile_id(id, full_name, role)")
    .eq("conversation_id", conversationId);

  if (error || !data) return [];

  return data
    .filter((row) => row.profile)
    .map((row) => ({
      id: row.profile!.id,
      fullName: row.profile!.full_name,
      role: row.profile!.role as AppRole,
    }))
    .sort((a, b) => {
      // Professor primeiro, depois os alunos em ordem alfabética.
      if (a.role !== b.role) return a.role === "student" ? 1 : -1;
      return a.fullName.localeCompare(b.fullName, "pt-BR");
    });
}

/**
 * Moderação: admin sempre; professor só no chat da turma que ele leciona.
 * Usa service-role de propósito — a checagem não pode depender da RLS de
 * quem pergunta, senão "não vejo a linha" e "a turma não é minha" viram o
 * mesmo resultado.
 */
export async function canModerateChat(
  ctx: SessionContext,
  conversationId: string,
): Promise<boolean> {
  if (ctx.realRole === "admin") return true;
  if (ctx.realRole !== "teacher") return false;

  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("conversations")
    .select("group:group_id(teacher_id)")
    .eq("id", conversationId)
    .maybeSingle();

  return data?.group?.teacher_id === ctx.userId;
}

/** Abre/fecha o chat para alunos. Autorização é responsabilidade de quem chama. */
export async function setStudentsCanPost(
  conversationId: string,
  allowed: boolean,
  actorId: string,
): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("conversations")
    .update({
      students_can_post: allowed,
      posting_changed_by: actorId,
      posting_changed_at: new Date().toISOString(),
    })
    .eq("id", conversationId);
  return !error;
}

/**
 * Soft delete: a linha fica, o corpo some da tela. Preserva a numeração do
 * histórico e mantém rastro para auditoria.
 */
export async function softDeleteMessage(messageId: string): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", messageId);
  return !error;
}

/** Autor da mensagem e conversa a que ela pertence — base da checagem de apagar. */
export async function getMessageOwner(
  messageId: string,
): Promise<{ senderId: string; conversationId: string } | null> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("messages")
    .select("sender_id, conversation_id")
    .eq("id", messageId)
    .maybeSingle();

  if (!data) return null;
  return { senderId: data.sender_id, conversationId: data.conversation_id };
}

/** Participação do usuário no chat — porta de entrada de toda escrita. */
export async function isChatParticipant(
  conversationId: string,
  userId: string,
): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("conversation_participants")
    .select("profile_id")
    .eq("conversation_id", conversationId)
    .eq("profile_id", userId)
    .maybeSingle();
  return Boolean(data);
}

/** Estado da trava — relido no servidor antes de aceitar uma mensagem. */
export async function getChatPostingState(
  conversationId: string,
): Promise<{ studentsCanPost: boolean; groupId: string | null } | null> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("conversations")
    .select("students_can_post, group_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (!data) return null;
  return { studentsCanPost: data.students_can_post, groupId: data.group_id };
}
