"use client";

/**
 * Mensagens do admin em duas abas, porque são duas coisas diferentes que a
 * escola chama pelo mesmo nome:
 *
 * - **Turmas**: o chat, uma conversa por turma, onde o admin entra como
 *   moderador (vê tudo, escreve, tranca).
 * - **Comunicados**: disparo de notificação, de mão única, para a escola
 *   inteira ou uma turma. Não é conversa e nunca foi.
 */

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { GroupsIcon, MegaphoneIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { AnnouncementForm } from "@/components/features/admin/announcement-form";
import {
  MessagesView,
  type SelectedChat,
} from "@/components/features/messaging/messages-view";
import type { GroupChatSummary } from "@/repositories/group-chats";
import type { GroupListItem } from "@/repositories/groups";

type Tab = "chats" | "announcements";

const TABS: { id: Tab; label: string; icon: typeof GroupsIcon }[] = [
  { id: "chats", label: "Chats das turmas", icon: GroupsIcon },
  { id: "announcements", label: "Comunicados", icon: MegaphoneIcon },
];

export function AdminMessagesView({
  chats,
  selected,
  groups,
  currentUserId,
  currentUserName,
}: {
  chats: GroupChatSummary[];
  selected: SelectedChat | null;
  groups: GroupListItem[];
  currentUserId: string;
  currentUserName: string;
}) {
  const [tab, setTab] = useState<Tab>("chats");
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <header className="shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight">Mensagens</h1>
        <p className="mt-1 text-sm text-admin-foreground/70">
          Acompanhe a conversa de cada turma ou dispare um comunicado para a escola.
        </p>

        <div
          role="tablist"
          aria-label="Seções de mensagens"
          className="mt-4 inline-flex rounded-xl border border-admin-border bg-admin-surface p-1"
        >
          {TABS.map((item) => {
            const active = tab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(item.id)}
                className={cn(
                  "relative inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent",
                  active
                    ? "text-admin-foreground"
                    : "text-admin-foreground/55 hover:text-admin-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="admin-messages-tab"
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 460, damping: 38 }
                    }
                    className="absolute inset-0 -z-10 rounded-lg bg-admin-muted"
                  />
                )}
                <Icon className="h-4 w-4" />
                {item.label}
                {item.id === "chats" && chats.length > 0 && (
                  <span className="tabular text-[11px] text-admin-foreground/45">
                    {chats.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {tab === "chats" ? (
        <MessagesView
          chats={chats}
          selected={selected}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          currentUserRole="admin"
        />
      ) : (
        <section className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-admin-border bg-admin-surface p-6 shadow-[var(--shadow-card)]">
          <h2 className="text-base font-semibold">Novo comunicado</h2>
          <p className="mt-1 max-w-lg text-sm text-admin-foreground/60">
            Chega como notificação — não entra no chat da turma.
          </p>
          <div className="mt-6">
            <AnnouncementForm groups={groups} />
          </div>
        </section>
      )}
    </div>
  );
}
