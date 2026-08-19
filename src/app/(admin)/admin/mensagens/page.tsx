import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { listGroups } from "@/repositories/groups";
import { getMyDisplayName } from "@/repositories/users";
import {
  getChatMessages,
  listChatMembers,
  listGroupChats,
} from "@/repositories/group-chats";
import { AdminMessagesView } from "@/components/features/admin/messages/admin-messages-view";
import type { SelectedChat } from "@/components/features/messaging/messages-view";

export const metadata: Metadata = { title: "Mensagens" };

interface PageProps {
  searchParams: Promise<{ c?: string }>;
}

/**
 * O admin enxerga o chat de todas as turmas da escola e modera qualquer um
 * deles — `canModerate` é constante aqui, não precisa de consulta por turma.
 */
export default async function AdminMensagensPage({ searchParams }: PageProps) {
  const ctx = await requireRole(["admin"]);
  const { c: requestedId } = await searchParams;

  const [chats, groups, displayName] = await Promise.all([
    listGroupChats(),
    listGroups(),
    getMyDisplayName(ctx.userId),
  ]);

  const chat = requestedId
    ? (chats.find((item) => item.conversationId === requestedId) ?? null)
    : null;

  let selected: SelectedChat | null = null;
  if (chat) {
    const [messages, members] = await Promise.all([
      getChatMessages(chat.conversationId),
      listChatMembers(chat.conversationId),
    ]);
    selected = { chat, messages, members, canModerate: true };
  }

  return (
    <AdminMessagesView
      chats={chats}
      selected={selected}
      groups={groups}
      currentUserId={ctx.userId}
      currentUserName={displayName ?? "Coordenação"}
    />
  );
}
