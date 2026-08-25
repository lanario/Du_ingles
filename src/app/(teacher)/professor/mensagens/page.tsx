import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { getMyDisplayName } from "@/repositories/users";
import {
  canModerateChat,
  getChatMessages,
  listChatMembers,
  listGroupChats,
} from "@/repositories/group-chats";
import {
  MessagesView,
  type SelectedChat,
} from "@/components/features/messaging/messages-view";

export const metadata: Metadata = { title: "Mensagens" };

interface PageProps {
  searchParams: Promise<{ c?: string }>;
}

/**
 * Chat das turmas do professor. A lista vem pela RLS (`listGroupChats` usa o
 * cliente do usuário), então o recorte "minhas turmas" não é um `if` aqui: um
 * `?c=` de turma alheia simplesmente não casa com nada e a tela fica vazia.
 *
 * Sem a aba de comunicados do admin — disparo para a escola inteira é
 * coordenação.
 */
export default async function ProfessorMensagensPage({ searchParams }: PageProps) {
  const ctx = await requireRole(["teacher"]);
  const { c: requestedId } = await searchParams;

  const [chats, displayName] = await Promise.all([
    listGroupChats(),
    getMyDisplayName(ctx.userId),
  ]);

  const chat = requestedId
    ? (chats.find((item) => item.conversationId === requestedId) ?? null)
    : null;

  let selected: SelectedChat | null = null;
  if (chat) {
    const [messages, members, canModerate] = await Promise.all([
      getChatMessages(chat.conversationId),
      listChatMembers(chat.conversationId),
      canModerateChat(ctx, chat.conversationId),
    ]);
    selected = { chat, messages, members, canModerate };
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <header className="shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight">Mensagens</h1>
        <p className="mt-1 text-sm text-admin-foreground/70">
          Avisos e conversa com cada uma das suas turmas.
        </p>
      </header>

      <MessagesView
        chats={chats}
        selected={selected}
        currentUserId={ctx.userId}
        currentUserName={displayName ?? "Professor"}
        currentUserRole="teacher"
      />
    </div>
  );
}
