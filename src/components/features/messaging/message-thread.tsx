"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  sendMessageAction,
  markConversationReadAction,
} from "@/actions/messaging/conversations";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import type { MessageItem } from "@/repositories/conversations";

export function MessageThread({
  conversationId,
  currentUserId,
  initialMessages,
}: {
  conversationId: string;
  currentUserId: string;
  initialMessages: MessageItem[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const action = sendMessageAction.bind(null, conversationId);
  const [state, formAction, isPending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    markConversationReadAction(conversationId);

    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            sender_id: string;
            body: string;
            created_at: string;
          };
          setMessages((prev) =>
            prev.some((m) => m.id === row.id)
              ? prev
              : [
                  ...prev,
                  {
                    id: row.id,
                    senderId: row.sender_id,
                    senderName: row.sender_id === currentUserId ? "Você" : "…",
                    body: row.body,
                    createdAt: row.created_at,
                    editedAt: null,
                  },
                ],
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={
              m.senderId === currentUserId
                ? "ml-auto max-w-[75%] text-right"
                : "max-w-[75%]"
            }
          >
            <div
              className={
                m.senderId === currentUserId
                  ? "inline-block rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                  : "inline-block rounded-lg bg-muted px-3 py-2 text-sm"
              }
            >
              {m.body}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {m.senderId !== currentUserId && `${m.senderName} · `}
              {new Date(m.createdAt).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        ref={formRef}
        action={formAction}
        className="flex gap-2 border-t border-border p-3"
      >
        <input
          name="body"
          placeholder="Escreva uma mensagem…"
          autoComplete="off"
          className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm"
        />
        <Button type="submit" disabled={isPending}>
          Enviar
        </Button>
      </form>
      {state && !state.success && (
        <p className="px-3 pb-2 text-sm text-destructive">{state.error.message}</p>
      )}
    </div>
  );
}
