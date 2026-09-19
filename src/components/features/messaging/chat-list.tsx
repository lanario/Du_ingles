"use client";

/**
 * Coluna das turmas. Uma linha por chat, ordenada pela conversa mais recente
 * — quem tem mensagem nova sobe sozinho, sem o usuário procurar.
 *
 * A revelação em cascata das linhas é CSS puro (`@keyframes chat-row-in` em
 * `globals.css`, com o atraso de cada linha em `--i`): toca sozinha quando a
 * linha entra no DOM e nunca mais — mover ou atualizar uma linha já montada
 * não reinsere o nó, então reordenar a lista numa mensagem nova não reanima
 * nada, sem precisar de nenhuma lógica "só na montagem" em JS. O trilho da
 * linha ativa é Framer, porque é ele que sabe animar de uma posição para
 * outra com `layoutId`.
 */

import { useMemo, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { SearchIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { filterChats, relativeStamp, totalUnread } from "./chat-utils";
import { GroupGlyph, PostingPill, UnreadBadge } from "./chat-visuals";
import type { GroupChatSummary } from "@/repositories/group-chats";

export function ChatList({
  chats,
  selectedId,
  onSelect,
  className,
}: {
  chats: GroupChatSummary[];
  selectedId: string | null;
  onSelect: (conversationId: string) => void;
  className?: string;
}) {
  const [term, setTerm] = useState("");

  const visible = useMemo(() => filterChats(chats, term), [chats, term]);
  const unread = totalUnread(chats);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col border-[var(--chat-border)] bg-[var(--chat-surface)]",
        className,
      )}
    >
      <div className="shrink-0 border-b border-[var(--chat-border)] px-4 pb-3 pt-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--chat-muted-fg)]">
            Turmas
          </h2>
          {unread > 0 && (
            <span className="text-[11px] font-medium text-[var(--chat-muted-fg)]">
              <span className="tabular">{unread}</span> não lida
              {unread === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <div className="relative mt-3">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--chat-muted-fg)]" />
          <input
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Buscar turma…"
            aria-label="Buscar turma"
            className={cn(
              "h-10 w-full rounded-xl border border-[var(--chat-border)] bg-[var(--chat-canvas)] pl-9 pr-3 text-sm",
              "text-[var(--chat-fg)] placeholder:text-[var(--chat-muted-fg)]",
              "transition-shadow focus:outline-none focus:ring-2 focus:ring-[var(--chat-accent)]",
            )}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
        {visible.map((chat, index) => (
          <ChatRow
            key={chat.conversationId}
            chat={chat}
            index={index}
            selected={chat.conversationId === selectedId}
            onSelect={onSelect}
          />
        ))}

        {visible.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-[var(--chat-muted-fg)]">
            {term
              ? "Nenhuma turma com esse nome."
              : "Você ainda não participa de nenhuma turma."}
          </p>
        )}
      </div>
    </div>
  );
}

function ChatRow({
  chat,
  index,
  selected,
  onSelect,
}: {
  chat: GroupChatSummary;
  index: number;
  selected: boolean;
  onSelect: (conversationId: string) => void;
}) {
  const preview = chat.lastMessageBody
    ? chat.lastMessageSender
      ? `${chat.lastMessageSender.split(" ")[0]}: ${chat.lastMessageBody}`
      : chat.lastMessageBody
    : "Nenhuma mensagem ainda";

  return (
    <button
      type="button"
      data-chat-row
      style={{ "--i": index } as CSSProperties}
      onClick={() => onSelect(chat.conversationId)}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left",
        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-accent)]",
        !selected && "hover:bg-[var(--chat-canvas)]",
      )}
    >
      {selected && (
        <motion.span
          layoutId="chat-row-active"
          transition={{ type: "spring", stiffness: 480, damping: 40, mass: 0.8 }}
          className="absolute inset-0 -z-10 rounded-2xl bg-[var(--chat-canvas)] shadow-[inset_0_0_0_1px_var(--chat-border)]"
        />
      )}
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--chat-accent)]",
          "origin-center transition-transform duration-200",
          selected ? "scale-y-100" : "scale-y-0",
        )}
      />

      <GroupGlyph name={chat.groupName} level={chat.level} muted={!chat.isActive} />

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--chat-fg)]">
            {chat.groupName}
          </span>
          <span className="shrink-0 text-[10px] tabular text-[var(--chat-muted-fg)]">
            {relativeStamp(chat.lastMessageAt)}
          </span>
        </span>

        <span className="mt-0.5 flex items-center gap-2">
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-xs",
              chat.unreadCount > 0
                ? "font-medium text-[var(--chat-fg)]"
                : "text-[var(--chat-muted-fg)]",
            )}
          >
            {preview}
          </span>
          <UnreadBadge count={chat.unreadCount} />
        </span>

        {!chat.studentsCanPost && (
          <span className="mt-1.5 flex">
            <PostingPill open={false} />
          </span>
        )}
      </span>
    </button>
  );
}
