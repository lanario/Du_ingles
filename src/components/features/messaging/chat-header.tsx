"use client";

/**
 * Cabeçalho da conversa: quem é a turma, quem está dentro e — para professor
 * e admin — a chave que abre ou fecha a palavra dos alunos.
 *
 * A chave é um `role="switch"` de verdade, não um botão que muda de rótulo:
 * leitor de tela anuncia o estado, e o estado otimista volta sozinho se o
 * servidor recusar.
 */

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { toggleStudentPostingAction } from "@/actions/messaging/group-chats";
import { ArrowLeftIcon, GroupsIcon, LockIcon, UnlockIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { GroupGlyph, MemberRoleTag, PostingPill, SenderAvatar } from "./chat-visuals";
import type { ChatMember, GroupChatSummary } from "@/repositories/group-chats";

export function ChatHeader({
  chat,
  members,
  canModerate,
  onBack,
  onPostingChange,
}: {
  chat: GroupChatSummary;
  members: ChatMember[];
  canModerate: boolean;
  onBack: () => void;
  onPostingChange: (allowed: boolean) => void;
}) {
  const [membersOpen, setMembersOpen] = useState(false);

  return (
    <header className="relative z-20 shrink-0 border-b border-[var(--chat-border)] bg-[var(--chat-surface)]">
      <div className="flex items-center gap-3 px-3 py-3 sm:px-5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar para a lista de turmas"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[var(--chat-muted-fg)] transition-colors hover:bg-[var(--chat-canvas)] hover:text-[var(--chat-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-accent)] md:hidden"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>

        <GroupGlyph name={chat.groupName} level={chat.level} size="lg" />

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-semibold text-[var(--chat-fg)]">
            {chat.groupName}
          </h1>
          <p className="truncate text-xs text-[var(--chat-muted-fg)]">
            {chat.teacherName}
            {!chat.isActive && " · turma arquivada"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setMembersOpen((open) => !open)}
          aria-expanded={membersOpen}
          className={cn(
            "hidden items-center gap-1.5 rounded-full border border-[var(--chat-border)] px-3 py-1.5 text-[11px] font-medium sm:inline-flex",
            "text-[var(--chat-muted-fg)] transition-colors hover:text-[var(--chat-fg)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-accent)]",
            membersOpen && "bg-[var(--chat-canvas)] text-[var(--chat-fg)]",
          )}
        >
          <GroupsIcon className="h-3.5 w-3.5" />
          <span className="tabular">{chat.memberCount}</span>
        </button>

        {canModerate ? (
          <PostingSwitch
            conversationId={chat.conversationId}
            allowed={chat.studentsCanPost}
            onChange={onPostingChange}
          />
        ) : (
          <PostingPill open={chat.studentsCanPost} className="hidden sm:inline-flex" />
        )}
      </div>

      <AnimatePresence>
        {membersOpen && (
          <MembersPanel members={members} onClose={() => setMembersOpen(false)} />
        )}
      </AnimatePresence>
    </header>
  );
}

/**
 * Chave de "alunos podem escrever". O estado otimista existe porque a ação
 * revalida a rota inteira — sem ele, a chave ficaria congelada na posição
 * antiga durante todo o round-trip.
 */
function PostingSwitch({
  conversationId,
  allowed,
  onChange,
}: {
  conversationId: string;
  allowed: boolean;
  onChange: (allowed: boolean) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(allowed);
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !optimistic;
    setError(null);
    startTransition(async () => {
      setOptimistic(next);
      const result = await toggleStudentPostingAction(conversationId, next);
      if (result.success) {
        onChange(next);
      } else {
        setError(result.error.message);
      }
    });
  }

  const Icon = optimistic ? UnlockIcon : LockIcon;
  const tone = optimistic ? "var(--success)" : "var(--warning)";

  return (
    <div className="relative">
      <button
        type="button"
        role="switch"
        aria-checked={optimistic}
        aria-label="Permitir que alunos escrevam nesta turma"
        disabled={pending}
        onClick={toggle}
        style={{ borderColor: `color-mix(in srgb, ${tone} 34%, transparent)` }}
        className={cn(
          "group flex items-center gap-2 rounded-full border py-1.5 pl-2.5 pr-1.5 text-[11px] font-medium",
          "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-accent)]",
          "disabled:opacity-60",
        )}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: tone }} />
        <span className="hidden whitespace-nowrap lg:inline" style={{ color: tone }}>
          {optimistic ? "Alunos podem escrever" : "Somente avisos"}
        </span>

        <span
          aria-hidden
          style={{ backgroundColor: `color-mix(in srgb, ${tone} 20%, #ffffff)` }}
          className="relative h-5 w-9 shrink-0 rounded-full transition-colors"
        >
          <motion.span
            layout
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 620, damping: 34 }
            }
            style={{
              backgroundColor: tone,
              left: optimistic ? "auto" : 3,
              right: optimistic ? 3 : "auto",
            }}
            className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full shadow-sm"
          />
        </span>
      </button>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute right-0 top-full z-30 mt-1.5 whitespace-nowrap rounded-lg bg-destructive px-2.5 py-1.5 text-[11px] text-destructive-foreground shadow-lg"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function MembersPanel({
  members,
  onClose,
}: {
  members: ChatMember[];
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    function onPointer(event: PointerEvent) {
      if (!panelRef.current?.contains(event.target as Node)) onClose();
    }
    window.addEventListener("keydown", onKey);
    // `pointerdown` no capture perderia o clique no próprio botão que abre o
    // painel; um tick de atraso deixa esse clique terminar primeiro.
    const timer = window.setTimeout(
      () => window.addEventListener("pointerdown", onPointer),
      0,
    );
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
      window.clearTimeout(timer);
    };
  }, [onClose]);

  return (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="absolute right-3 top-full z-30 mt-1 max-h-80 w-64 overflow-y-auto rounded-2xl border border-[var(--chat-border)] bg-[var(--chat-surface)] p-2 shadow-[var(--shadow-card-hover)] sm:right-5"
    >
      <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--chat-muted-fg)]">
        Participantes
      </p>
      <ul className="space-y-0.5">
        {members.map((member) => (
          <li
            key={member.id}
            className="flex items-center gap-2.5 rounded-xl px-2 py-1.5"
          >
            <SenderAvatar id={member.id} name={member.fullName} size="xs" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-[var(--chat-fg)]">
                {member.fullName}
              </span>
              <MemberRoleTag role={member.role} />
            </span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
