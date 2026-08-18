import type { Metadata } from "next";
import Link from "next/link";
import { getSessionContext } from "@/lib/auth/session";
import {
  listMyConversations,
  getConversationMessages,
  listAllowedContacts,
} from "@/repositories/conversations";
import { MessageThread } from "@/components/features/messaging/message-thread";
import { NewConversationForm } from "@/components/features/messaging/new-conversation-form";

export const metadata: Metadata = { title: "Mensagens" };

interface PageProps {
  searchParams: Promise<{ c?: string }>;
}

export default async function MensagensPage({ searchParams }: PageProps) {
  const ctx = await getSessionContext();
  if (!ctx) return null;
  const { c: selectedId } = await searchParams;

  const [conversations, contacts] = await Promise.all([
    listMyConversations(ctx.userId),
    listAllowedContacts(ctx),
  ]);

  const messages = selectedId ? await getConversationMessages(selectedId) : [];

  return (
    <div className="grid h-[calc(100vh-8rem)] grid-cols-[280px_1fr] gap-4">
      <aside className="flex flex-col gap-4 overflow-y-auto rounded-lg border border-border p-3">
        <NewConversationForm contacts={contacts} />
        <ul className="space-y-1">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link
                href={`/mensagens?c=${c.id}`}
                className={
                  c.id === selectedId
                    ? "block rounded-md bg-muted px-3 py-2 text-sm font-medium"
                    : "block rounded-md px-3 py-2 text-sm hover:bg-muted"
                }
              >
                <span className="flex items-center justify-between">
                  {c.title}
                  {c.unread && <span className="h-2 w-2 rounded-full bg-primary" />}
                </span>
              </Link>
            </li>
          ))}
          {conversations.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              Nenhuma conversa ainda.
            </li>
          )}
        </ul>
      </aside>

      <section className="rounded-lg border border-border">
        {selectedId ? (
          <MessageThread
            conversationId={selectedId}
            currentUserId={ctx.userId}
            initialMessages={messages}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Selecione uma conversa
          </div>
        )}
      </section>
    </div>
  );
}
