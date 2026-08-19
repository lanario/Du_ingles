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
 * Chat das turmas. O aluno vê a turma em que está matriculado; o professor,
 * as turmas que leciona — os dois recortes vêm da RLS, não de um `if` aqui.
 *
 * A conversa selecionada é carregada no servidor: `chats.find` faz as vezes
 * de guarda de acesso, porque a lista já só contém o que este usuário pode
 * ver. Um `?c=` de outra turma simplesmente não casa e a tela volta ao vazio.
 */
export default async function MensagensPage({ searchParams }: PageProps) {
  const ctx = await requireRole(["teacher", "student"]);
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
        <p className="mt-1 text-sm text-muted-foreground">
          {ctx.effectiveRole === "teacher"
            ? "Avisos e conversa com cada uma das suas turmas."
            : "O canal direto com o professor e os colegas da sua turma."}
        </p>
      </header>

      <MessagesView
        chats={chats}
        selected={selected}
        currentUserId={ctx.userId}
        currentUserName={displayName ?? "Você"}
        currentUserRole={ctx.effectiveRole}
        readOnly={ctx.isViewAs}
      />
    </div>
  );
}
