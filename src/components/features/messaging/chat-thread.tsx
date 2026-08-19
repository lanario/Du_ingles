"use client";

/**
 * A conversa em si.
 *
 * Três coisas acontecem aqui ao mesmo tempo e por isso ficam separadas:
 *
 * 1. Realtime — INSERT e UPDATE de `messages` chegam pelo canal do Supabase.
 *    O payload traz só a linha crua (sem o nome de quem escreveu), então há
 *    um cache de nomes alimentado pela lista de participantes e completado
 *    sob demanda para quem não é participante (o admin, por exemplo).
 * 2. Envio otimista — a bolha aparece antes do round-trip e é reconciliada
 *    quando o próprio INSERT volta pelo canal.
 * 3. Rolagem — só acompanha o fim da conversa se você já estava lá. Ler
 *    histórico antigo e ser arrastado para baixo por uma mensagem nova é a
 *    forma mais rápida de tornar um chat inutilizável.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import gsap from "gsap";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  deleteChatMessageAction,
  markChatReadAction,
  sendChatMessageAction,
} from "@/actions/messaging/group-chats";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { ChevronIcon, MessageIcon, TrashIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { groupMessages, timeLabel } from "./chat-utils";
import { AuthorTag, SenderAvatar } from "./chat-visuals";
import { ChatComposer } from "./chat-composer";
import type { ChatMember, ChatMessage } from "@/repositories/group-chats";
import type { AppRole } from "@/types/domain";

/** Distância do fim abaixo da qual a thread continua colada no rodapé. */
const STICK_THRESHOLD_PX = 120;

interface PendingMessage {
  tempId: string;
  body: string;
  createdAt: string;
}

export function ChatThread({
  conversationId,
  currentUserId,
  currentUserName,
  currentUserRole,
  initialMessages,
  members,
  canModerate,
  canPost,
  lockedReason,
}: {
  conversationId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: AppRole;
  initialMessages: ChatMessage[];
  members: ChatMember[];
  canModerate: boolean;
  canPost: boolean;
  lockedReason: string | null;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [missed, setMissed] = useState(0);
  const [atBottom, setAtBottom] = useState(true);
  const reduceMotion = useReducedMotion();

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const jumpRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  // Nomes já conhecidos: participantes + o próprio usuário. O realtime só
  // manda ids, e uma query por mensagem recebida seria N+1 em tempo real.
  const nameCache = useRef(new Map<string, { name: string; role: AppRole }>());
  useEffect(() => {
    members.forEach((member) =>
      nameCache.current.set(member.id, { name: member.fullName, role: member.role }),
    );
    nameCache.current.set(currentUserId, {
      name: currentUserName,
      role: currentUserRole,
    });
  }, [members, currentUserId, currentUserName, currentUserRole]);

  // Trocar de turma reinicia a thread inteira — inclusive as pendentes, que
  // pertenciam à conversa anterior.
  useEffect(() => {
    setMessages(initialMessages);
    setPending([]);
    setMissed(0);
    setAtBottom(true);
    stickRef.current = true;
  }, [conversationId, initialMessages]);

  /* ------------------------------------------------------------- realtime */

  useEffect(() => {
    void markChatReadAction(conversationId);
    const supabase = createBrowserSupabaseClient();

    /** Preenche o nome de um remetente desconhecido e reescreve as bolhas dele. */
    async function hydrateSender(senderId: string) {
      if (nameCache.current.has(senderId)) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", senderId)
        .maybeSingle();
      if (!data) return;
      nameCache.current.set(senderId, { name: data.full_name, role: data.role });
      setMessages((prev) =>
        prev.map((message) =>
          message.senderId === senderId
            ? { ...message, senderName: data.full_name, senderRole: data.role }
            : message,
        ),
      );
    }

    const channel = supabase
      .channel(`group-chat:${conversationId}`)
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
          const known = nameCache.current.get(row.sender_id);
          if (!known) void hydrateSender(row.sender_id);

          setMessages((prev) => {
            if (prev.some((message) => message.id === row.id)) return prev;
            return [
              ...prev,
              {
                id: row.id,
                senderId: row.sender_id,
                senderName: known?.name ?? "…",
                senderRole: known?.role ?? "student",
                body: row.body,
                createdAt: row.created_at,
                editedAt: null,
                isDeleted: false,
              },
            ];
          });

          // A confirmação da própria mensagem aposenta a bolha otimista.
          if (row.sender_id === currentUserId) {
            setPending((prev) => {
              const index = prev.findIndex((item) => item.body === row.body);
              if (index === -1) return prev;
              return prev.filter((_, position) => position !== index);
            });
          } else if (!stickRef.current) {
            setMissed((count) => count + 1);
          }

          void markChatReadAction(conversationId);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            body: string;
            edited_at: string | null;
            deleted_at: string | null;
          };
          setMessages((prev) =>
            prev.map((message) =>
              message.id === row.id
                ? {
                    ...message,
                    body: row.body,
                    editedAt: row.edited_at,
                    isDeleted: row.deleted_at !== null,
                  }
                : message,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId]);

  /* -------------------------------------------------------------- rolagem */

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      bottomRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : behavior });
      stickRef.current = true;
      setAtBottom(true);
      setMissed(0);
    },
    [reduceMotion],
  );

  // Abrir a conversa cai direto no fim, sem animação: a mensagem mais nova é
  // o assunto, o histórico é que precisa ser procurado.
  useEffect(() => {
    const container = scrollRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [conversationId]);

  useEffect(() => {
    if (stickRef.current) scrollToBottom();
  }, [messages.length, pending.length, scrollToBottom]);

  function onScroll() {
    const container = scrollRef.current;
    if (!container) return;
    const distance =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const nowAtBottom = distance < STICK_THRESHOLD_PX;
    stickRef.current = nowAtBottom;
    // Só re-renderiza na *virada* — atualizar estado a cada evento de rolagem
    // custaria um render por frame.
    setAtBottom((previous) => (previous === nowAtBottom ? previous : nowAtBottom));
    if (nowAtBottom && missed > 0) setMissed(0);
  }

  // O botão "ir para o fim" é escondido/mostrado pelo GSAP, não por
  // montar/desmontar: remontá-lo a cada mudança seria trabalho de layout à
  // toa, e ele precisa poder aparecer no meio de uma rolagem.
  useEffect(() => {
    const jump = jumpRef.current;
    if (!jump) return;
    const visible = missed > 0 || !atBottom;
    gsap.to(jump, {
      autoAlpha: visible ? 1 : 0,
      y: visible ? 0 : 8,
      duration: reduceMotion ? 0 : 0.24,
      ease: "power2.out",
      overwrite: true,
    });
  }, [missed, atBottom, reduceMotion]);

  /* ---------------------------------------------------------------- envio */

  const handleSend = useCallback(
    async (body: string) => {
      const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setPending((prev) => [
        ...prev,
        { tempId, body, createdAt: new Date().toISOString() },
      ]);
      stickRef.current = true;

      const formData = new FormData();
      formData.set("body", body);
      const result = await sendChatMessageAction(conversationId, null, formData);

      if (!result.success) {
        setPending((prev) => prev.filter((item) => item.tempId !== tempId));
        return { ok: false, message: result.error.message };
      }
      return { ok: true };
    },
    [conversationId],
  );

  /* -------------------------------------------------------------- render */

  const days = useMemo(() => {
    const optimistic: ChatMessage[] = pending.map((item) => ({
      id: item.tempId,
      senderId: currentUserId,
      senderName: currentUserName,
      senderRole: currentUserRole,
      body: item.body,
      createdAt: item.createdAt,
      editedAt: null,
      isDeleted: false,
    }));
    return groupMessages([...messages, ...optimistic]);
  }, [messages, pending, currentUserId, currentUserName, currentUserRole]);

  const pendingIds = useMemo(
    () => new Set(pending.map((item) => item.tempId)),
    [pending],
  );

  const isEmpty = days.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="chat-weave h-full overflow-y-auto overscroll-contain px-3 py-4 sm:px-6"
        >
          {isEmpty ? (
            <EmptyThread canPost={canPost} />
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-1">
              {days.map((day) => (
                <section key={day.key} className="flex flex-col gap-1">
                  <DaySeparator label={day.label} />
                  {day.runs.map((run) => (
                    <MessageRunBubbles
                      key={run.key}
                      run={run}
                      own={run.senderId === currentUserId}
                      canModerate={canModerate}
                      currentUserId={currentUserId}
                      pendingIds={pendingIds}
                    />
                  ))}
                </section>
              ))}
            </div>
          )}
          <div ref={bottomRef} className="h-1" />
        </div>

        <div
          ref={jumpRef}
          style={{ opacity: 0, visibility: "hidden" }}
          className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center"
        >
          <button
            type="button"
            onClick={() => scrollToBottom()}
            className={cn(
              "pointer-events-auto inline-flex items-center gap-2 rounded-full border border-[var(--chat-border)]",
              "bg-[var(--chat-surface)] py-2 pl-3 pr-3.5 text-xs font-medium text-[var(--chat-fg)]",
              "shadow-[var(--shadow-card-hover)] transition-transform hover:-translate-y-0.5",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-accent)]",
            )}
          >
            <ChevronIcon className="h-3.5 w-3.5 rotate-90" />
            {missed > 0
              ? `${missed} mensagem${missed === 1 ? "" : "s"} nova${missed === 1 ? "" : "s"}`
              : "Ir para o fim"}
          </button>
        </div>
      </div>

      <ChatComposer
        onSend={handleSend}
        disabled={!canPost}
        lockedReason={lockedReason}
        placeholder={
          canModerate ? "Escreva um aviso para a turma…" : "Escreva para a turma…"
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------------ peças */

function DaySeparator({ label }: { label: string }) {
  return (
    <div className="sticky top-0 z-10 my-3 flex justify-center">
      <span className="rounded-full border border-[var(--chat-border)] bg-[var(--chat-surface)]/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--chat-muted-fg)] backdrop-blur">
        {label}
      </span>
    </div>
  );
}

function MessageRunBubbles({
  run,
  own,
  canModerate,
  currentUserId,
  pendingIds,
}: {
  run: ReturnType<typeof groupMessages>[number]["runs"][number];
  own: boolean;
  canModerate: boolean;
  currentUserId: string;
  pendingIds: Set<string>;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div className={cn("flex gap-2.5 pt-2", own && "flex-row-reverse")}>
      {!own && (
        <SenderAvatar id={run.senderId} name={run.senderName} className="mt-auto" />
      )}

      <div
        className={cn(
          "flex min-w-0 max-w-[min(78%,34rem)] flex-col gap-0.5",
          own && "items-end",
        )}
      >
        {!own && (
          <p className="flex items-center gap-1.5 pl-1">
            <span className="truncate text-[11px] font-semibold text-[var(--chat-fg)]">
              {run.senderName}
            </span>
            <AuthorTag role={run.senderRole} />
          </p>
        )}

        <AnimatePresence initial={false}>
          {run.messages.map((message, index) => (
            <motion.div
              key={message.id}
              layout={!reduceMotion}
              initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 460, damping: 34, mass: 0.7 }}
              className={cn(
                "group/message flex items-end gap-1.5",
                own && "flex-row-reverse",
              )}
            >
              <Bubble
                message={message}
                own={own}
                first={index === 0}
                pending={pendingIds.has(message.id)}
              />
              {!message.isDeleted &&
                !pendingIds.has(message.id) &&
                (own || canModerate) && (
                  <DeleteMessageButton
                    messageId={message.id}
                    ownMessage={message.senderId === currentUserId}
                  />
                )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Bubble({
  message,
  own,
  first,
  pending,
}: {
  message: ChatMessage;
  own: boolean;
  first: boolean;
  pending: boolean;
}) {
  if (message.isDeleted) {
    return (
      <p
        className={cn(
          "rounded-2xl border border-dashed border-[var(--chat-border)] px-3.5 py-2 text-xs italic text-[var(--chat-muted-fg)]",
        )}
      >
        Mensagem apagada
      </p>
    );
  }

  return (
    <div
      className={cn(
        "min-w-0 px-3.5 py-2 text-sm leading-relaxed shadow-sm transition-opacity",
        // O canto "quebrado" só na primeira bolha da sequência amarra as
        // mensagens seguidas do mesmo autor num bloco só.
        own
          ? cn(
              "bg-[var(--chat-own)] text-[var(--chat-own-fg)]",
              first ? "rounded-2xl rounded-br-md" : "rounded-2xl rounded-r-md",
            )
          : cn(
              "border border-[var(--chat-border)] bg-[var(--chat-surface)] text-[var(--chat-fg)]",
              first ? "rounded-2xl rounded-bl-md" : "rounded-2xl rounded-l-md",
            ),
        pending && "opacity-60",
      )}
    >
      <p className="whitespace-pre-wrap break-words">{message.body}</p>
      <p
        className={cn(
          "mt-1 flex items-center justify-end gap-1 text-[10px] tabular",
          own ? "text-[var(--chat-own-fg)]/60" : "text-[var(--chat-muted-fg)]",
        )}
      >
        {pending ? "enviando…" : timeLabel(message.createdAt)}
        {message.editedAt && !pending && " · editada"}
      </p>
    </div>
  );
}

function DeleteMessageButton({
  messageId,
  ownMessage,
}: {
  messageId: string;
  ownMessage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function onClick() {
    if (!confirming) {
      setConfirming(true);
      window.setTimeout(() => setConfirming(false), 3000);
      return;
    }
    startTransition(async () => {
      await deleteChatMessageAction(messageId);
      setConfirming(false);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label={
        confirming
          ? "Confirmar exclusão da mensagem"
          : ownMessage
            ? "Apagar minha mensagem"
            : "Apagar mensagem da turma"
      }
      className={cn(
        "grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-accent)]",
        confirming
          ? "bg-destructive text-destructive-foreground opacity-100"
          : "text-[var(--chat-muted-fg)] opacity-0 hover:bg-[var(--chat-surface)] hover:text-destructive group-hover/message:opacity-100 focus-visible:opacity-100",
      )}
    >
      <TrashIcon className="h-3.5 w-3.5" />
    </button>
  );
}

function EmptyThread({ canPost }: { canPost: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-surface)] text-[var(--chat-muted-fg)]">
        <MessageIcon className="h-6 w-6" />
      </span>
      <p className="text-sm font-medium text-[var(--chat-fg)]">
        Nenhuma mensagem por aqui ainda
      </p>
      <p className="max-w-xs text-xs text-[var(--chat-muted-fg)]">
        {canPost
          ? "Mande a primeira — todo mundo da turma recebe."
          : "Assim que o professor escrever, a conversa aparece aqui."}
      </p>
    </div>
  );
}
