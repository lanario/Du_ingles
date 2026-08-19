"use client";

/**
 * Área de usuários: barra de ferramentas fixa, busca instantânea, abas por
 * papel e cartões — mesmo modelo de listagem usado no resto do painel
 * (ver `components/motion/list-motion.ts`). O detalhe abre num painel
 * lateral, então nenhuma ação tira o admin da lista.
 *
 * A busca é local: a página já entrega a organização inteira, então filtrar
 * em memória é imediato e não passa termo pela URL.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { deactivateUserAction, reactivateUserAction } from "@/actions/admin/users";
import { getUserByIdAction } from "@/actions/admin/users-detail";
import { CountUp } from "@/components/features/admin/dashboard/primitives";
import {
  PlusIcon,
  SearchIcon,
  CloseIcon,
  ShieldIcon,
  GraduationIcon,
  UserIcon,
} from "@/components/ui/icons";
import { useStickyBar, useListProgress } from "@/components/motion/list-motion";
import { cn } from "@/lib/utils";
import type { UserListItem, UserDetail as UserDetailData } from "@/repositories/users";
import type { AppRole } from "@/types/domain";
import { InviteUserPanel } from "./invite-user-panel";
import { UserCard } from "./user-card";
import { UserDetail } from "./user-detail";
import { byHierarchy, userMatches, type RoleFilter } from "./users-utils";

interface UsersViewProps {
  users: UserListItem[];
  myUserId: string;
  /** Abre o painel de convite já na entrada (rota com `?convite=`). */
  openInvite?: boolean;
  /** Papel pré-selecionado no convite — "Novo aluno" já chega como aluno. */
  inviteRole?: AppRole;
}

const TABS: { id: RoleFilter; label: string; icon: typeof ShieldIcon }[] = [
  { id: "all", label: "Todos", icon: UserIcon },
  { id: "admin", label: "Admins", icon: ShieldIcon },
  { id: "teacher", label: "Professores", icon: GraduationIcon },
  { id: "student", label: "Alunos", icon: UserIcon },
];

export function UsersView({
  users,
  myUserId,
  openInvite = false,
  inviteRole,
}: UsersViewProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<RoleFilter>("all");

  const [detail, setDetail] = useState<UserDetailData | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailSession, setDetailSession] = useState(0);
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(openInvite);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { sentinelRef, barRef } = useStickyBar<HTMLDivElement>();
  const lineRef = useListProgress(listRef);

  const totals = useMemo(
    () => ({
      all: users.length,
      admin: users.filter((u) => u.role === "admin").length,
      teacher: users.filter((u) => u.role === "teacher").length,
      student: users.filter((u) => u.role === "student").length,
    }),
    [users],
  );

  const filtered = useMemo(
    () =>
      users
        .filter((u) => tab === "all" || u.role === tab)
        .filter((u) => userMatches(u, search))
        .sort(byHierarchy),
    [users, tab, search],
  );

  // "/" leva direto para a busca, como no resto do painel.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;
      event.preventDefault();
      searchRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  async function openDetail(user: UserListItem) {
    setError(null);
    setLoadingDetailId(user.id);
    try {
      const full = await getUserByIdAction(user.id);
      if (!full) {
        setError("Não foi possível carregar este usuário.");
        return;
      }
      setDetail(full);
      setDetailSession((n) => n + 1);
      setDetailOpen(true);
    } finally {
      setLoadingDetailId(null);
    }
  }

  async function deactivate(user: UserListItem) {
    setError(null);
    setBusy(user.id);
    try {
      const result = await deactivateUserAction(user.id);
      if (!result.success) setError(result.error.message);
      else router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function reactivate(user: UserListItem) {
    setError(null);
    setBusy(user.id);
    try {
      const result = await reactivateUserAction(user.id);
      if (!result.success) setError(result.error.message);
      else router.refresh();
    } finally {
      setBusy(null);
    }
  }

  /**
   * Fechar o painel também limpa o `?convite=` da URL: sem isso, um F5
   * (ou o `router.refresh()` de qualquer ação da lista) reabriria o
   * convite que o admin acabou de fechar.
   */
  function closeInvite() {
    setInviteOpen(false);
    if (openInvite) router.replace("/admin/usuarios");
  }

  const searchActive = search.trim() !== "";

  return (
    <div className="pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-admin-foreground">Usuários</h1>
          <p className="mt-2 max-w-xl text-sm text-admin-foreground/60">
            Admins, professores e alunos da organização.
          </p>
        </div>

        <dl className="flex flex-wrap gap-2">
          <Indicator label="Total" value={totals.all} />
          <Indicator label="Admins" value={totals.admin} tone="var(--navy-800)" />
          <Indicator label="Professores" value={totals.teacher} tone="var(--gold-700)" />
          <Indicator label="Alunos" value={totals.student} tone="var(--navy-500)" />
        </dl>
      </div>

      {/* Sentinela do ScrollTrigger: marca onde a barra passa a ficar grudada. */}
      <div ref={sentinelRef} aria-hidden className="mt-6 h-px" />

      <div
        ref={barRef}
        data-stuck="false"
        className={cn(
          "sticky top-16 z-30 -mx-6 mb-4 flex flex-wrap items-center gap-2 border-b border-transparent px-6 py-3 sm:mb-5 sm:gap-3",
          "bg-[color-mix(in_srgb,var(--admin-background)_88%,transparent)] backdrop-blur-md transition-[border-color,box-shadow] duration-300",
          "data-[stuck=true]:border-admin-border data-[stuck=true]:shadow-[0_18px_30px_-28px_rgba(11,26,51,0.35)]",
        )}
      >
        {/* Progresso da rolagem da lista (GSAP com scrub). */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px]">
          <span
            ref={lineRef}
            className="block h-full w-full origin-left bg-gradient-to-r from-navy-700 to-gold-500"
          />
        </span>

        <div
          role="group"
          aria-label="Papéis"
          className="flex max-w-full flex-wrap items-center gap-1 rounded-xl border border-admin-border bg-admin-surface p-1"
        >
          {TABS.map((item) => {
            const active = tab === item.id;
            const Icon = item.icon;
            const count = totals[item.id];
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => setTab(item.id)}
                className={cn(
                  "relative rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors sm:px-3 sm:text-sm",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
                  active ? "text-admin-foreground" : "text-admin-foreground/50 hover:text-admin-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="du-usuarios-tab"
                    aria-hidden
                    className="absolute inset-0 rounded-lg bg-admin-muted shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--gold-500)_30%,transparent)]"
                    transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 480, damping: 38 }}
                  />
                )}
                <span className="relative flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
                      active ? "bg-gold-100 text-gold-700" : "bg-admin-muted text-admin-foreground/50",
                    )}
                  >
                    {count}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative order-last w-full min-w-[12rem] flex-1 sm:order-none sm:w-auto">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-foreground/40" />
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Buscar usuários"
            placeholder="Buscar por nome, e-mail, papel ou status..."
            className="w-full rounded-xl border border-admin-border bg-admin-surface py-2.5 pl-10 pr-10 text-sm text-admin-foreground outline-none transition-colors placeholder:text-admin-foreground/40 hover:border-gold-300 focus:border-gold-500 focus-visible:ring-2 focus-visible:ring-gold-500/35 [&::-webkit-search-cancel-button]:hidden"
          />
          <AnimatePresence>
            {search !== "" && (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => {
                  setSearch("");
                  searchRef.current?.focus();
                }}
                aria-label="Limpar busca"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-admin-foreground/40 transition-colors hover:bg-admin-muted hover:text-admin-foreground"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <motion.button
          type="button"
          onClick={() => setInviteOpen(true)}
          whileHover={reduceMotion ? undefined : { scale: 1.03 }}
          whileTap={reduceMotion ? undefined : { scale: 0.97 }}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold-600 to-gold-400 px-3 py-2.5 text-sm font-semibold text-admin-foreground shadow-[0_8px_24px_-12px_rgba(201,162,39,0.75)] transition-opacity hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 sm:px-4"
        >
          <PlusIcon className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Novo usuário</span>
        </motion.button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mb-5 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div ref={listRef}>
        {filtered.length === 0 ? (
          <EmptyState
            icon={UserIcon}
            title="Nada encontrado"
            description="Ajuste a busca ou a aba para encontrar alguém."
            action={
              searchActive ? (
                <SecondaryButton onClick={() => setSearch("")}>Limpar busca</SecondaryButton>
              ) : null
            }
          />
        ) : (
          <motion.div layout className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <AnimatePresence mode="popLayout" initial={false}>
              {filtered.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  isSelf={user.id === myUserId}
                  busy={busy === user.id || loadingDetailId === user.id}
                  onOpen={() => openDetail(user)}
                  onDeactivate={() => deactivate(user)}
                  onReactivate={() => reactivate(user)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      <InviteUserPanel
        open={inviteOpen}
        onClose={closeInvite}
        {...(inviteRole ? { defaultRole: inviteRole } : {})}
      />

      <UserDetail
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        user={detail}
        session={detailSession}
      />
    </div>
  );
}

function Indicator({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-admin-border bg-admin-surface px-3.5 py-2">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-admin-foreground/50">
        {label}
      </dt>
      <dd
        className="text-lg font-semibold tabular-nums text-admin-foreground"
        style={tone ? { color: tone } : undefined}
      >
        <CountUp value={value} />
      </dd>
    </div>
  );
}

function SecondaryButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-admin-border px-4 py-2.5 text-sm text-admin-foreground/60 transition hover:bg-admin-muted hover:text-admin-foreground"
    >
      {children}
    </button>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof UserIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-admin-border px-6 py-16 text-center"
    >
      <span className="grid h-14 w-14 place-items-center rounded-full bg-admin-muted text-admin-foreground/40">
        <Icon className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-base font-semibold text-admin-foreground">{title}</h2>
      <p className="mt-1.5 max-w-sm text-sm text-admin-foreground/60">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}
