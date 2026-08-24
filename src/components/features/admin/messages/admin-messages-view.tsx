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
import { GroupsIcon, MegaphoneIcon } from "@/components/ui/icons";
import { SlideTabs } from "@/components/ui/slide-tabs";
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

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <header className="shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight">Mensagens</h1>
        <p className="mt-1 text-sm text-admin-foreground/70">
          Acompanhe a conversa de cada turma ou dispare um comunicado para a escola.
        </p>

        <SlideTabs
          className="mt-4"
          tone="surface"
          label="Seções de mensagens"
          value={tab}
          onValueChange={(value) => setTab(value as Tab)}
          items={TABS.map(({ id, label, icon: Icon }) => ({
            value: id,
            label,
            icon: <Icon aria-hidden />,
            badge: id === "chats" && chats.length > 0 ? chats.length : undefined,
          }))}
        />
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
