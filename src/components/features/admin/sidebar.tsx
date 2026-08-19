"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/actions/auth/logout";
import { NotificationBell } from "@/components/features/notification-bell";
import type { NotificationItem } from "@/repositories/notifications";
import { LogoutIcon } from "@/components/ui/icons";

const RAIL_WIDTH = 64;
const PANEL_WIDTH = 252;
const OPEN_DELAY = 90;
const CLOSE_DELAY = 120;
const GLOW_HEIGHT = 72;

const NAV_SECTIONS = [
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
      { href: "/admin/agenda", label: "Agenda", icon: "calendar" },
      { href: "/admin/financeiro", label: "Financeiro", icon: "coin" },
      { href: "/admin/relatorios", label: "Relatórios", icon: "chart" },
      { href: "/admin/mensagens", label: "Mensagens", icon: "chat" },
      { href: "/admin/ver-como", label: "Ver como", icon: "eye" },
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
] as const;

type IconName = (typeof NAV_SECTIONS)[number]["items"][number]["icon"];

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
  eye: (
    <>
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.8" />
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
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.3 9.6c0-1.4 1.3-2.3 2.7-2.3s2.7.9 2.7 2.1c0 3-5.4 1.6-5.4 4.5 0 1.3 1.3 2.3 2.7 2.3s2.7-.9 2.7-2.3" />
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
  "group relative flex h-10 w-full items-center gap-3 rounded-lg pl-2.5 pr-3 text-sm transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-900 focus-visible:ring-offset-2 focus-visible:ring-offset-admin-shell";

interface AdminSidebarProps {
  organizationLabel: string;
  userId: string;
  email: string;
  initialNotifications: NotificationItem[];
  initialUnreadCount: number;
}

/**
 * Rail navy/dourado do admin — mesmo mecanismo hover-expand do sidebar do
 * aluno/professor (`AppSidebar`), só que na paleta `admin-shell-*` para que a
 * leitura de "outro contexto" continue imediata mesmo com o formato irmão.
 */
export function AdminSidebar({
  organizationLabel,
  userId,
  email,
  initialNotifications,
  initialUnreadCount,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const expanded = hovered || focused;

  const [loggingOut, startLogout] = useTransition();

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

  // `/admin` casaria com tudo por prefixo; a raiz precisa de match exato.
  const isActive = (href: string) =>
    href === "/admin" ? pathname === href : pathname.startsWith(href);

  return (
    <aside
      className="relative z-40 hidden h-full shrink-0 md:block"
      style={{ width: RAIL_WIDTH }}
    >
      <motion.div
        ref={panelRef}
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
            aria-label="Navegação administrativa"
            className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2"
          >
            {NAV_SECTIONS.map((section, index) => (
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
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          ROW_CLASS,
                          active
                            ? "font-medium text-admin-shell-foreground"
                            : "text-admin-shell-foreground/70 hover:text-admin-shell-foreground",
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
                            className="absolute inset-0 -z-10 rounded-lg bg-admin-shell-foreground/10"
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
                        <span className={cn("flex-none", active ? "text-navy-900" : undefined)}>
                          <NavIcon name={item.icon} />
                        </span>
                        <span
                          data-nav-label
                          style={{ opacity: 0 }}
                          className="truncate whitespace-nowrap"
                        >
                          {item.label}
                        </span>
                      </Link>
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

            <div
              className={cn(
                "overflow-hidden transition-all duration-200",
                expanded ? "mt-1 max-h-10 opacity-100" : "max-h-0 opacity-0",
              )}
            >
              <p className="truncate px-2.5 py-1.5 text-xs text-admin-shell-foreground/60">
                {email}
              </p>
            </div>

            <button
              type="button"
              disabled={loggingOut}
              onClick={() =>
                startLogout(async () => {
                  await logoutAction();
                })
              }
              className={cn(
                ROW_CLASS,
                "text-admin-shell-foreground/70 hover:bg-red-500/10 hover:text-red-700 disabled:opacity-60",
              )}
            >
              <LogoutIcon className="h-[18px] w-[18px] flex-none" />
              <span data-nav-label style={{ opacity: 0 }} className="whitespace-nowrap">
                {loggingOut ? "Saindo…" : "Sair"}
              </span>
            </button>
          </div>
        </div>
      </motion.div>
    </aside>
  );
}
