import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SessionContext } from "@/lib/auth/session";

export interface ConversationListItem {
  id: string;
  title: string;
  lastMessageAt: string | null;
  unread: boolean;
}

export interface MessageItem {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
}

export interface Contact {
  id: string;
  fullName: string;
}

export async function listMyConversations(
  userId: string,
): Promise<ConversationListItem[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("conversation_participants")
    .select(
      "last_read_at, conversation:conversation_id(id, type, title, last_message_at, group:group_id(name), participants:conversation_participants(profile:profile_id(id, full_name)))",
    )
    .eq("profile_id", userId);

  if (error || !data) return [];

  return data
    .filter((row) => row.conversation)
    .map((row) => {
      const conv = row.conversation!;
      let title = conv.title ?? "";
      if (!title) {
        if (conv.type === "group") {
          title = conv.group?.name ?? "Turma";
        } else {
          const other = conv.participants?.find((p) => p.profile?.id !== userId);
          title = other?.profile?.full_name ?? "Conversa";
        }
      }
      const unread =
        !!conv.last_message_at &&
        (!row.last_read_at || row.last_read_at < conv.last_message_at);
      return {
        id: conv.id,
        title,
        lastMessageAt: conv.last_message_at,
        unread,
      };
    })
    .sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""));
}

export async function getConversationMessages(
  conversationId: string,
): Promise<MessageItem[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("messages")
    .select(
      "id, sender_id, body, created_at, edited_at, deleted_at, sender:sender_id(full_name)",
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    senderId: row.sender_id,
    senderName: row.sender?.full_name ?? "—",
    body: row.deleted_at ? "(mensagem apagada)" : row.body,
    createdAt: row.created_at,
    editedAt: row.edited_at,
  }));
}

/** Quem o usuário atual pode iniciar uma conversa direta — reflete a regra
 * "aluno não fala com aluno" (§8.5) já no nível de UI, além do trigger no banco. */
export async function listAllowedContacts(ctx: SessionContext): Promise<Contact[]> {
  const supabase = await createServerSupabaseClient();

  if (ctx.effectiveRole === "student") {
    const { data } = await supabase
      .from("enrollments")
      .select("group:group_id(teacher:teacher_id(id, full_name))")
      .eq("student_id", ctx.userId)
      .eq("status", "active");
    const map = new Map<string, string>();
    (data ?? []).forEach((row) => {
      const teacher = row.group?.teacher;
      if (teacher) map.set(teacher.id, teacher.full_name);
    });
    return Array.from(map, ([id, fullName]) => ({ id, fullName }));
  }

  if (ctx.effectiveRole === "teacher") {
    const { data: students } = await supabase
      .from("groups")
      .select("enrollments(student:student_id(id, full_name))")
      .eq("teacher_id", ctx.userId);
    const map = new Map<string, string>();
    (students ?? []).forEach((g) =>
      g.enrollments?.forEach((e) => {
        if (e.student) map.set(e.student.id, e.student.full_name);
      }),
    );
    const { data: staff } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("role", ["teacher", "admin"])
      .neq("id", ctx.userId);
    (staff ?? []).forEach((s) => map.set(s.id, s.full_name));
    return Array.from(map, ([id, fullName]) => ({ id, fullName }));
  }

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .neq("id", ctx.userId);
  return (data ?? []).map((p) => ({ id: p.id, fullName: p.full_name }));
}

export async function findDirectConversation(
  userId: string,
  otherUserId: string,
): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("conversation_participants")
    .select("conversation:conversation_id(id, type)")
    .eq("profile_id", userId);

  for (const row of data ?? []) {
    if (row.conversation?.type !== "direct") continue;
    const { data: others } = await supabase
      .from("conversation_participants")
      .select("profile_id")
      .eq("conversation_id", row.conversation.id);
    const ids = (others ?? []).map((o) => o.profile_id);
    if (ids.includes(otherUserId) && ids.includes(userId) && ids.length === 2) {
      return row.conversation.id;
    }
  }
  return null;
}
