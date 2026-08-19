"use client";

/**
 * Cartão de um usuário. Mesmo desenho dos cartões de KPI do painel: o
 * transform é do framer-motion (layout + hover).
 */

import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { CalendarIcon, MailIcon, UserIcon, PowerIcon } from "@/components/ui/icons";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { onOpenClick } from "@/components/ui/detail-panel";
import { cn } from "@/lib/utils";
import type { UserListItem } from "@/repositories/users";
import {
  CopyButton,
  PendingPasswordPill,
  RolePill,
  StatusPill,
  UserAvatar,
} from "./users-visuals";
import { formatDate } from "./users-utils";

interface UserCardProps {
  user: UserListItem;
  /** Cartão do usuário logado — não pode se desativar por aqui. */
  isSelf: boolean;
  busy: boolean;
  onOpen: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
}

export function UserCard({ user, isSelf, busy, onOpen, onDeactivate, onReactivate }: UserCardProps) {
  const reduceMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);

  const canManage = !isSelf;

  const actions: ActionMenuItem[] = [
    {
      label: "Ver detalhes",
      icon: UserIcon,
      onSelect: onOpen,
    },
  ];
  if (canManage) {
    actions.push(
      user.isActive
        ? { label: "Desativar", icon: PowerIcon, tone: "danger", separated: true, onSelect: onDeactivate }
        : { label: "Reativar", icon: PowerIcon, tone: "accent", separated: true, onSelect: onReactivate },
    );
  }

  return (
    <motion.article
      layout
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.8 }}
      whileHover={reduceMotion ? undefined : { y: -4 }}
      onClick={onOpenClick(onOpen)}
      className={cn(
        "group relative flex cursor-pointer flex-col rounded-2xl border p-5 transition-colors duration-300",
        "border-admin-border bg-admin-surface",
        "shadow-[0_1px_2px_rgba(11,26,51,0.04),0_10px_30px_-20px_rgba(11,26,51,0.4)]",
        "hover:border-gold-300",
        menuOpen && "z-20",
        busy && "opacity-60",
        !user.isActive && "opacity-70",
      )}
    >
      <div className="relative flex items-start justify-between gap-2">
        <StatusPill isActive={user.isActive} />
        <ActionMenu items={actions} disabled={busy} onOpenChange={setMenuOpen} label={`Ações de ${user.fullName}`} />
      </div>

      <div className="relative mt-3 flex flex-col items-center text-center">
        <motion.span
          whileHover={reduceMotion ? undefined : { scale: 1.06 }}
          transition={{ type: "spring", stiffness: 400, damping: 18 }}
        >
          <UserAvatar id={user.id} name={user.fullName} />
        </motion.span>

        {/*
          O nome é um botão de verdade: o clique no cartão inteiro é
          comodidade de mouse, e o teclado precisa de um alvo focável.
        */}
        <h3 title={user.fullName} className="mt-3 w-full text-[15px] font-semibold leading-snug">
          <button
            type="button"
            onClick={onOpen}
            className="block max-w-full truncate text-admin-foreground transition-colors hover:text-gold-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
          >
            {user.fullName}
          </button>
        </h3>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
          <RolePill role={user.role} />
          {user.mustChangePassword && <PendingPasswordPill />}
        </div>
      </div>

      <ul className="relative mt-4 space-y-2.5 border-t border-admin-border pt-4 text-xs">
        <li className="flex items-center gap-2.5">
          <MailIcon className="h-3.5 w-3.5 shrink-0 text-admin-foreground/40" />
          <span className="min-w-0 flex-1 truncate text-admin-foreground/60">{user.email}</span>
          <CopyButton value={user.email} label={`Copiar e-mail de ${user.fullName}`} />
        </li>
        <li className="flex items-center gap-2.5">
          <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-admin-foreground/40" />
          <span className="min-w-0 flex-1 truncate text-admin-foreground/60">
            Cadastrado em {formatDate(user.createdAt)}
          </span>
        </li>
      </ul>
    </motion.article>
  );
}
