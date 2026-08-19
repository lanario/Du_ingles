"use client";

/**
 * Tela de Mensagens: lista de turmas à esquerda, conversa à direita.
 *
 * A turma selecionada vive na URL (`?c=…`) e não em estado local — assim o
 * histórico do navegador funciona, o link é compartilhável e as mensagens
 * chegam já renderizadas do servidor em vez de num segundo fetch no cliente.
 *
 * Abaixo de `md` as duas colunas viram uma só: lista *ou* conversa, com a
 * conversa entrando por cima. Chat em coluna de 320px no celular não é chat.
 */

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Route } from "next";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { MessageIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { ChatList } from "./chat-list";
import { ChatHeader } from "./chat-header";
import { ChatThread } from "./chat-thread";
import type {
  ChatMember,
  ChatMessage,
  GroupChatSummary,
} from "@/repositories/group-chats";
import type { AppRole } from "@/types/domain";

export interface SelectedChat {
  chat: GroupChatSummary;
  messages: ChatMessage[];
  members: ChatMember[];
  canModerate: boolean;
}

export function MessagesView({
  chats,
  selected,
  currentUserId,
  currentUserName,
  currentUserRole,
  readOnly,
}: {
  chats: GroupChatSummary[];
  selected: SelectedChat | null;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: AppRole;
  /** Sessão "ver como": o admin observa a tela do aluno sem poder escrever. */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [, startTransition] = useTransition();

  // A trava tem duas fontes: a ação de moderação nesta aba e o realtime de
  // `conversations` (o professor trancou de outro dispositivo). As duas
  // escrevem aqui para que o campo de escrita reaja na hora, sem refresh.
  const [postingOverride, setPostingOverride] = useState<boolean | null>(null);
  const conversationId = selected?.chat.conversationId ?? null;

  useEffect(() => {
    setPostingOverride(null);
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`chat-state:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as { students_can_post: boolean };
          setPostingOverride(row.students_can_post);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const select = useCallback(
    (id: string) => {
      startTransition(() => {
        router.push(`${pathname}?c=${id}` as Route, { scroll: false });
      });
    },
    [pathname, router],
  );

  const clearSelection = useCallback(() => {
    startTransition(() => {
      router.push(pathname as Route, { scroll: false });
    });
  }, [pathname, router]);

  const studentsCanPost = postingOverride ?? selected?.chat.studentsCanPost ?? true;
  const isStudent = currentUserRole === "student" && !selected?.canModerate;

  const canPost = Boolean(selected) && !readOnly && (!isStudent || studentsCanPost);
  const lockedReason = !selected
    ? null
    : readOnly
      ? "Modo “ver como” é somente leitura."
      : isStudent && !studentsCanPost
        ? "O professor desativou as mensagens dos alunos nesta turma."
        : null;

  return (
    <div className="chat-theme flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-surface)] shadow-[var(--shadow-card)]">
      <ChatList
        chats={chats}
        selectedId={conversationId}
        onSelect={select}
        className={cn(
          "w-full shrink-0 md:w-[21rem] md:border-r",
          // No celular a lista some quando há conversa aberta — não é uma
          // coluna estreita, é a tela inteira dando lugar à outra.
          selected && "hidden md:flex",
        )}
      />

      <div className="relative min-w-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          {selected ? (
            <motion.section
              key={selected.chat.conversationId}
              initial={reduceMotion ? false : { opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 flex min-h-0 flex-col"
            >
              <ChatHeader
                chat={{ ...selected.chat, studentsCanPost }}
                members={selected.members}
                canModerate={selected.canModerate && !readOnly}
                onBack={clearSelection}
                onPostingChange={setPostingOverride}
              />
              <ChatThread
                conversationId={selected.chat.conversationId}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                currentUserRole={currentUserRole}
                initialMessages={selected.messages}
                members={selected.members}
                canModerate={selected.canModerate && !readOnly}
                canPost={canPost}
                lockedReason={lockedReason}
              />
            </motion.section>
          ) : (
            <motion.div
              key="empty"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="chat-weave absolute inset-0 hidden flex-col items-center justify-center gap-3 px-8 text-center md:flex"
            >
              <span className="grid h-16 w-16 place-items-center rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-surface)] text-[var(--chat-muted-fg)]">
                <MessageIcon className="h-7 w-7" />
              </span>
              <p className="text-sm font-medium text-[var(--chat-fg)]">
                Escolha uma turma
              </p>
              <p className="max-w-xs text-xs text-[var(--chat-muted-fg)]">
                {chats.length === 0
                  ? "Quando você for designado a uma turma, o chat dela aparece aqui automaticamente."
                  : "Cada turma tem seu próprio chat — avisos e conversa no mesmo lugar."}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
