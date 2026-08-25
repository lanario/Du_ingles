"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { NavLink } from "@/components/ui/nav-link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/features/account/user-menu";
import { NotificationBell } from "@/components/features/notification-bell";
import { RoleSwitch } from "@/components/features/admin/role-switch";
import type { NotificationItem } from "@/repositories/notifications";
import type { MyProfile } from "@/repositories/users";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";

const RAIL_WIDTH = 64;
const PANEL_WIDTH = 252;
const OPEN_DELAY = 90;
const CLOSE_DELAY = 120;
const GLOW_HEIGHT = 72;

export interface AdminNavItem {
  href: Route;
  label: string;
  icon: IconName;
}

export interface AdminNavSection {
  label: string;
  items: AdminNavItem[];
}

/** Mapa completo da coordenação — o padrão quando nenhuma seção é passada. */
export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    label: "Visão geral",
    items: [{ href: "/admin", label: "Painel", icon: "grid" }],
  },
  {
    label: "Gestão",
    items: [
      { href: "/admin/usuarios", label: "Usuários", icon: "users" },
      { href: "/admin/alunos", label: "Alunos", icon: "graduation" },
      { href: "/admin/turmas", label: "Turmas", icon: "board" },
      { href: "/admin/cursos", label: "Cursos", icon: "book" },
      { href: "/admin/planos-de-alunos", label: "Planos de alunos", icon: "clipboard" },
    ],
  },
  {
    label: "Operação",
    items: [
      { href: "/admin/planejador", label: "Planejador de aulas", icon: "lesson" },
      { href: "/admin/financeiro", label: "Financeiro", icon: "coin" },
      { href: "/admin/relatorios", label: "Relatórios", icon: "chart" },
      { href: "/admin/mensagens", label: "Mensagens", icon: "chat" },
      { href: "/admin/auditoria", label: "Auditoria", icon: "shield" },
    ],
  },
  {
    label: "Conta",
    items: [
      { href: "/admin/meus-dados", label: "Meus dados", icon: "user" },
      { href: "/admin/configuracoes", label: "Configurações", icon: "gear" },
    ],
  },
];

export type IconName =
  | "grid"
  | "users"
  | "book"
  | "board"
  | "chart"
  | "chat"
  | "shield"
  | "user"
  | "graduation"
  | "clipboard"
  | "coin"
  | "lesson"
  | "gear";

const PATHS: Record<IconName, React.ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M17 5.2a3.5 3.5 0 0 1 0 6.6M18 20a6 6 0 0 0-2.2-4.6" />
    </>
  ),
  book: (
    <>
      <path d="M4 4h6a3 3 0 0 1 2 2.6V20a2.4 2.4 0 0 0-2-1H4Z" />
      <path d="M20 4h-6a3 3 0 0 0-2 2.6V20a2.4 2.4 0 0 1 2-1h6Z" />
    </>
  ),
  board: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 9v11" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  chat: (
    <>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5.2A8 8 0 1 1 21 12Z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7.5 3v5.5c0 4.4-3.1 8.2-7.5 9.5-4.4-1.3-7.5-5.1-7.5-9.5V6Z" />
      <path d="M9.5 12l1.8 1.8L15 10" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.8" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  graduation: (
    <>
      <path d="M2 8.5 12 4l10 4.5-10 4.5-10-4.5Z" />
      <path d="M6.5 10.8V16c0 1.7 2.5 3 5.5 3s5.5-1.3 5.5-3v-5.2" />
      <path d="M21 9v5.5" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5" y="4.5" width="14" height="17" rx="2" />
      <path d="M9 3.5h6a1 1 0 0 1 1 1v1.5H8V4.5a1 1 0 0 1 1-1Z" />
      <path d="M8.5 12h7M8.5 16h5" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.3 9.6c0-1.4 1.3-2.3 2.7-2.3s2.7.9 2.7 2.1c0 3-5.4 1.6-5.4 4.5 0 1.3 1.3 2.3 2.7 2.3s2.7-.9 2.7-2.3" />
    </>
  ),
  lesson: (
    <>
      <path d="M5 4.5h8.5L19 10v9.5a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 4 19.5v-13A1.5 1.5 0 0 1 5.5 5Z" />
      <path d="M13 4.5V10h5.5" />
      <path d="m10.2 17.4-2.6.6.6-2.6 4.6-4.6a1.3 1.3 0 0 1 1.9 1.9Z" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3v2.4M12 18.6V21M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M3 12h2.4M18.6 12H21M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7" />
    </>
  ),
};

function NavIcon({ name }: { name: IconName }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-none"
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}

const ROW_CLASS =
  "group relative flex h-10 w-full items-center gap-3 rounded-2xl pl-2.5 pr-3 text-sm transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-900 focus-visible:ring-offset-2 focus-visible:ring-offset-admin-shell";

interface AdminSidebarProps {
  organizationLabel: string;
  userId: string;
  email: string;
  fullName: string;
  /** Foto de perfil já pronta para o `src` (`/api/avatars/...`) ou `null`. */
  avatarUrl: string | null;
  /** Dados editáveis do modal de perfil (telefone, nascimento etc). */
  profile: MyProfile | null;
  initialNotifications: NotificationItem[];
  initialUnreadCount: number;
  /** Mapa de navegação — o padrão é o da coordenação. */
  sections?: AdminNavSection[];
  /** Rota-raiz da área: a única que casa por igualdade, não por prefixo. */
  rootHref?: string;
  /** Papel exibido no menu da conta. */
  role?: "admin" | "teacher";
  /** Destino de "Meus dados" no menu da conta. */
  dataHref?: Route;
  /**
   * A chave "ver como" é da coordenação. A área do professor não alterna
   * para lado nenhum — quem dá aula tem um contexto só.
   */
  showRoleSwitch?: boolean;
  navLabel?: string;
}

// A raiz da área (`/admin`, `/professor`) casaria com tudo por prefixo — só
// ela precisa de match exato.
function isActivePath(pathname: string, href: string, rootHref: string) {
  return href === rootHref
    ? pathname === href
    : pathname === href || pathname.startsWith(href + "/");
}

function itemAtivo(pathname: string, sections: AdminNavSection[], rootHref: string) {
  return (
    sections
      .flatMap((section) => section.items)
      // Do mais específico para o mais genérico: `/admin/turmas` tem que
      // ganhar de `/admin` na hora de rotular o cabeçalho mobile.
      .sort((a, b) => b.href.length - a.href.length)
      .find((item) => isActivePath(pathname, item.href, rootHref))
  );
}

/** Emblema "Du" do chrome admin, em duas variantes (compacta/completa). */
function Brand({ compact }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-white p-1.5">
        <Image
          src="/logo_amarela.svg"
          alt="Du Inglês"
          width={36}
          height={36}
          className="h-full w-full object-contain"
          priority
        />
      </span>
      {!compact && (
        <span className="whitespace-nowrap text-sm font-semibold tracking-tight">
          Du Inglês
        </span>
      )}
    </span>
  );
}

/**
 * Navegação do painel administrativo. Duas peças com o mesmo mapa de rotas,
 * cada uma para um tamanho de tela — mesmo par usado na área do
 * aluno/professor (`AppSidebar`), aqui na paleta `admin-shell-*`:
 *
 * - `AdminRail` (>= md): rail de 64px que expande no hover/foco.
 * - `AdminNavMobile` (< md): barra superior fina + gaveta lateral por toque.
 *   Sem ela o admin simplesmente não tinha navegação no celular — o rail é
 *   `hidden md:block` e nada o substituía.
 */
export function AdminSidebar(props: AdminSidebarProps) {
  return (
    <>
      <AdminNavMobile {...props} />
      <AdminRail {...props} />
    </>
  );
}

function AdminRail({
  organizationLabel,
  userId,
  email,
  fullName,
  avatarUrl,
  profile,
  initialNotifications,
  initialUnreadCount,
  sections = ADMIN_NAV_SECTIONS,
  rootHref = "/admin",
  role = "admin",
  dataHref = "/admin/meus-dados",
  navLabel = "Navegação administrativa",
}: AdminSidebarProps) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const expanded = hovered || focused;

  const panelRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<number | null>(null);
  const glowY = useRef<((value: number) => void) | null>(null);

  const clearTimer = () => {
    if (hoverTimer.current !== null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };

  const scheduleHover = useCallback((next: boolean) => {
    clearTimer();
    hoverTimer.current = window.setTimeout(
      () => setHovered(next),
      next ? OPEN_DELAY : CLOSE_DELAY,
    );
  }, []);

  useEffect(() => clearTimer, []);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const labels = panel.querySelectorAll<HTMLElement>("[data-nav-label]");
    if (labels.length === 0) return;

    if (reduceMotion) {
      gsap.set(labels, { opacity: expanded ? 1 : 0, x: 0 });
      return;
    }

    gsap.to(labels, {
      opacity: expanded ? 1 : 0,
      x: expanded ? 0 : -6,
      duration: expanded ? 0.3 : 0.12,
      ease: expanded ? "power3.out" : "power2.in",
      stagger: expanded ? 0.018 : 0,
      overwrite: true,
    });

    return () => {
      gsap.killTweensOf(labels);
    };
  }, [expanded, reduceMotion]);

  useEffect(() => {
    const glow = glowRef.current;
    if (!glow || reduceMotion) return;
    glowY.current = gsap.quickTo(glow, "y", { duration: 0.45, ease: "power3.out" });
    return () => {
      glowY.current = null;
      gsap.killTweensOf(glow);
    };
  }, [reduceMotion]);

  const moveGlow = useCallback(
    (clientY: number, instant = false) => {
      const panel = panelRef.current;
      const glow = glowRef.current;
      if (!panel || !glow || reduceMotion) return;
      const y = clientY - panel.getBoundingClientRect().top - GLOW_HEIGHT / 2;
      if (instant) {
        gsap.set(glow, { y });
        gsap.to(glow, { opacity: 1, duration: 0.3, ease: "power2.out" });
        return;
      }
      glowY.current?.(y);
    },
    [reduceMotion],
  );

  const hideGlow = useCallback(() => {
    const glow = glowRef.current;
    if (!glow || reduceMotion) return;
    gsap.to(glow, { opacity: 0, duration: 0.25, ease: "power2.in" });
  }, [reduceMotion]);

  const isActive = (href: string) => isActivePath(pathname, href, rootHref);

  return (
    <aside
      className="relative z-40 hidden h-full shrink-0 md:block"
      style={{ width: RAIL_WIDTH }}
    >
      <motion.div
        ref={panelRef}
        data-sidebar-panel
        initial={false}
        animate={{ width: expanded ? PANEL_WIDTH : RAIL_WIDTH }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 320, damping: 34, mass: 0.9 }
        }
        onPointerEnter={(event) => {
          scheduleHover(true);
          moveGlow(event.clientY, true);
        }}
        onPointerMove={(event) => moveGlow(event.clientY)}
        onPointerLeave={() => {
          scheduleHover(false);
          hideGlow();
        }}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setFocused(false);
          }
        }}
        className={cn(
          "absolute inset-y-0 left-0 flex flex-col overflow-hidden border-r border-admin-shell-border",
          "bg-admin-shell text-admin-shell-foreground transition-shadow duration-300",
          expanded && "shadow-[10px_0_40px_-10px_rgba(0,0,0,0.35)]",
        )}
      >
        <div
          ref={glowRef}
          aria-hidden
          style={{ opacity: 0, height: GLOW_HEIGHT }}
          className="pointer-events-none absolute right-0 top-0 w-[2px] rounded-full bg-gradient-to-b from-transparent via-navy-900 to-transparent shadow-[0_0_12px_2px_rgba(10,31,68,0.45)]"
        />

        {/* Largura fixa: só a máscara do painel se move, o conteúdo nunca reflui. */}
        <div className="flex h-full flex-col" style={{ width: PANEL_WIDTH }}>
          <div className="relative flex h-16 shrink-0 flex-col justify-center border-b border-admin-shell-border px-3">
            <span className="flex items-center gap-3">
              <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-white p-1.5">
                <Image
                  src="/logo_amarela.svg"
                  alt="Du Inglês"
                  width={36}
                  height={36}
                  className="h-full w-full object-contain"
                  priority
                />
              </span>
              <span
                data-nav-label
                style={{ opacity: 0 }}
                className="whitespace-nowrap text-sm font-semibold tracking-tight"
              >
                Du Inglês
              </span>
            </span>
            <span
              data-nav-label
              style={{ opacity: 0 }}
              className="mt-0.5 whitespace-nowrap pl-12 text-[10px] uppercase tracking-[0.14em] text-admin-shell-foreground/70"
            >
              {organizationLabel}
            </span>
          </div>

          <nav
            aria-label={navLabel}
            className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2"
          >
            {sections.map((section, index) => (
              <div key={section.label}>
                {index > 0 && <div className="my-1.5 h-px bg-admin-shell-border" />}
                <p
                  data-nav-label
                  style={{ opacity: 0 }}
                  className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-admin-shell-foreground/40"
                >
                  {section.label}
                </p>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <NavLink
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          ROW_CLASS,
                          active
                            ? "font-medium text-admin-shell-foreground"
                            : "text-admin-shell-foreground/70 hover:bg-navy-900/10 hover:text-navy-900",
                        )}
                      >
                        {active && (
                          <motion.span
                            layoutId="admin-nav-active"
                            transition={{
                              type: "spring",
                              stiffness: 480,
                              damping: 38,
                              mass: 0.7,
                            }}
                            className="absolute inset-0 -z-10 rounded-2xl bg-navy-900/15"
                          />
                        )}
                        <span
                          aria-hidden
                          className={cn(
                            "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-navy-900",
                            "origin-center transition-transform duration-200",
                            active ? "scale-y-100" : "scale-y-0",
                          )}
                        />
                        <span
                          className={cn(
                            "flex-none transition-colors",
                            active ? "text-navy-900" : "group-hover:text-navy-900",
                          )}
                        >
                          <NavIcon name={item.icon} />
                        </span>
                        <span
                          data-nav-label
                          style={{ opacity: 0 }}
                          className="truncate whitespace-nowrap"
                        >
                          {item.label}
                        </span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-admin-shell-border px-3 py-2">
            <NotificationBell
              userId={userId}
              initialNotifications={initialNotifications}
              initialUnreadCount={initialUnreadCount}
              variant="rail"
              theme="admin"
              label="Notificações"
            />

            <UserMenu
              userId={userId}
              name={fullName}
              email={email}
              role={role}
              avatarUrl={avatarUrl}
              profile={profile}
              theme="admin"
              dataHref={dataHref}
              compact
              className="mt-1"
            />
          </div>
        </div>
      </motion.div>
    </aside>
  );
}

/* ------------------------------------------------------------------ mobile */

const DRAWER_CLASS = "w-[min(18rem,84vw)]";

/* Alvo de toque de 44px (min-h-11) em cada linha — no rail de desktop as
   linhas têm 40px, que é confortável de clicar mas apertado de tocar. */
const MOBILE_ROW_CLASS =
  "group relative flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 text-[15px] font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-900 focus-visible:ring-offset-2 focus-visible:ring-offset-admin-shell";

function AdminNavMobile({
  organizationLabel,
  userId,
  email,
  fullName,
  avatarUrl,
  profile,
  initialNotifications,
  initialUnreadCount,
  sections = ADMIN_NAV_SECTIONS,
  rootHref = "/admin",
  role = "admin",
  dataHref = "/admin/meus-dados",
  showRoleSwitch = true,
  navLabel = "Navegação administrativa",
}: AdminSidebarProps) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [routeAtOpen, setRouteAtOpen] = useState(pathname);
  const atual = itemAtivo(pathname, sections, rootHref);

  // Navegar fecha a gaveta durante a renderização (não em efeito), assim ela
  // já sai fechada no mesmo passo em que a rota muda — inclui o botão
  // "voltar" do navegador, que não passa pelo onClick do link.
  if (open && routeAtOpen !== pathname) {
    setOpen(false);
  }

  function abrir() {
    setRouteAtOpen(pathname);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <header className="z-30 flex h-14 shrink-0 items-center gap-2 border-b border-admin-shell-border bg-admin-shell/95 px-2 pt-[env(safe-area-inset-top,0px)] text-admin-shell-foreground backdrop-blur md:hidden">
        <button
          type="button"
          onClick={abrir}
          aria-label="Abrir navegação"
          aria-expanded={open}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-admin-shell-foreground/70 transition-colors hover:bg-admin-shell-foreground/10 hover:text-admin-shell-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-900"
        >
          <MenuIcon className="h-6 w-6" />
        </button>

        <Brand compact />

        {atual && (
          <span className="ml-0.5 min-w-0 truncate text-sm font-semibold">
            {atual.label}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {showRoleSwitch && (
            <RoleSwitch active="admin" awayLabel="Aluno" awayRole="student" collapsed />
          )}
          <NotificationBell
            userId={userId}
            initialNotifications={initialNotifications}
            initialUnreadCount={initialUnreadCount}
            theme="admin"
          />
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[70] md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-navy-950/40 backdrop-blur-[2px]"
            />
            <motion.nav
              aria-label={navLabel}
              role="dialog"
              aria-modal="true"
              initial={reduceMotion ? { opacity: 0 } : { x: "-100%" }}
              animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { x: "-100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 40 }}
              className={cn(
                "absolute inset-y-0 left-0 flex flex-col border-r border-admin-shell-border bg-admin-shell text-admin-shell-foreground shadow-2xl",
                DRAWER_CLASS,
              )}
            >
              <div className="shrink-0 border-b border-admin-shell-border px-3 pt-[env(safe-area-inset-top,0px)]">
                <div className="flex h-14 items-center justify-between gap-2">
                  <span className="flex min-w-0 flex-col">
                    <Brand />
                    <span className="truncate pl-12 text-[10px] uppercase tracking-[0.14em] text-admin-shell-foreground/70">
                      {organizationLabel}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Fechar navegação"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-admin-shell-foreground/70 transition-colors hover:bg-admin-shell-foreground/10 hover:text-admin-shell-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-900"
                  >
                    <CloseIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain px-2 py-2">
                {sections.map((section, index) => (
                  <div key={section.label}>
                    {index > 0 && <div className="my-1.5 h-px bg-admin-shell-border" />}
                    <p className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-admin-shell-foreground/50">
                      {section.label}
                    </p>
                    <div className="space-y-0.5">
                      {section.items.map((item) => {
                        const active = isActivePath(pathname, item.href, rootHref);
                        return (
                          <NavLink
                            key={item.href}
                            href={item.href}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              MOBILE_ROW_CLASS,
                              active
                                ? "bg-navy-900/15 text-admin-shell-foreground"
                                : "text-admin-shell-foreground/70 hover:bg-navy-900/10 hover:text-navy-900 active:bg-navy-900/15",
                            )}
                          >
                            {active && (
                              <span
                                aria-hidden
                                className="absolute -left-2 bottom-1.5 top-1.5 w-[3px] rounded-r-full bg-navy-900"
                              />
                            )}
                            <span
                              className={cn(
                                "flex-none",
                                active
                                  ? "text-navy-900"
                                  : "text-admin-shell-foreground/60",
                              )}
                            >
                              <NavIcon name={item.icon} />
                            </span>
                            {item.label}
                          </NavLink>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="shrink-0 border-t border-admin-shell-border px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]">
                <UserMenu
                  userId={userId}
                  name={fullName}
                  email={email}
                  role={role}
                  avatarUrl={avatarUrl}
                  profile={profile}
                  theme="admin"
                  dataHref={dataHref}
                />
              </div>
            </motion.nav>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
