"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/types/domain";
import { UserMenu } from "@/components/features/account/user-menu";
import { RoleSwitch } from "@/components/features/admin/role-switch";
import { NotificationBell } from "@/components/features/notification-bell";
import type { NotificationItem } from "@/repositories/notifications";
import type { MyProfile } from "@/repositories/users";
import {
  CloseIcon,
  GroupsIcon,
  HomeIcon,
  type IconProps,
  LibraryIcon,
  MenuIcon,
  MessageIcon,
  PlanIcon,
  ProgressIcon,
  TaskIcon,
  UserIcon,
} from "@/components/ui/icons";

const RAIL_WIDTH = 64;
const PANEL_WIDTH = 252;
const OPEN_DELAY = 90;
const CLOSE_DELAY = 120;
const GLOW_HEIGHT = 72;

interface NavItem {
  href: Route;
  label: string;
  icon: ComponentType<IconProps>;
  roles: readonly AppRole[];
}

interface NavSection {
  id: string;
  label: string;
  items: readonly NavItem[];
}

const NAV_SECTIONS: readonly NavSection[] = [
  {
    id: "estudo",
    label: "Estudo",
    items: [
      {
        href: "/dashboard",
        label: "Início",
        icon: HomeIcon,
        roles: ["teacher", "student"],
      },
      {
        href: "/planos-de-aula",
        label: "Planos de aula",
        icon: PlanIcon,
        roles: ["teacher"],
      },
      {
        href: "/tarefas",
        label: "Tarefas",
        icon: TaskIcon,
        roles: ["teacher", "student"],
      },
      {
        href: "/progresso",
        label: "Meu progresso",
        icon: ProgressIcon,
        roles: ["student"],
      },
    ],
  },
  {
    id: "turmas",
    label: "Turmas",
    items: [
      {
        href: "/turmas",
        label: "Turmas",
        icon: GroupsIcon,
        roles: ["teacher", "student"],
      },
      {
        href: "/biblioteca",
        label: "Biblioteca",
        icon: LibraryIcon,
        roles: ["teacher", "student"],
      },
      {
        href: "/mensagens",
        label: "Mensagens",
        icon: MessageIcon,
        roles: ["teacher", "student"],
      },
    ],
  },
  {
    id: "conta",
    label: "Conta",
    items: [
      {
        href: "/planos",
        label: "Meu plano",
        icon: PlanIcon,
        roles: ["student"],
      },
      {
        href: "/meus-dados",
        label: "Meus dados",
        icon: UserIcon,
        roles: ["teacher", "student"],
      },
    ],
  },
];

const ALL_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);

/** Rota filha mantém o item pai ativo (ex.: /tarefas/123 acende "Tarefas"). */
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

function itemAtivo(pathname: string) {
  return ALL_ITEMS.find((item) => isActive(pathname, item.href));
}

function sectionsFor(role: AppRole) {
  // Admin sem papel escolhido (bypass de `requireRole` sem cookie de "ver
  // como") não tem itens próprios — cai no mapa do aluno até escolher um
  // papel no switch acima.
  const effective = role === "admin" ? "student" : role;
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.includes(effective)),
  })).filter((section) => section.items.length > 0);
}

const ROW_CLASS =
  "group relative flex h-10 w-full items-center gap-3 rounded-2xl pl-2.5 pr-3 text-sm transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2 focus-visible:ring-offset-app-shell";

/** Emblema "Du" — mesma peça usada em todo o chrome logado, aqui em duas
 * variantes (compacta/completa) para o cross-fade do cabeçalho da sidebar. */
function Brand({ compact, labelled }: { compact?: boolean; labelled?: boolean }) {
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
        <span
          {...(labelled ? { "data-nav-label": "", style: { opacity: 0 } } : {})}
          className="whitespace-nowrap text-sm font-semibold tracking-tight text-app-shell-foreground"
        >
          Du Inglês
        </span>
      )}
    </span>
  );
}

interface SidebarProps {
  role: AppRole;
  userId: string;
  email: string;
  fullName: string;
  /** Foto de perfil já pronta para o `src` (`/api/avatars/...`) ou `null`. */
  avatarUrl: string | null;
  /** Dados editáveis do modal de perfil (telefone, nascimento etc). */
  profile: MyProfile | null;
  initialNotifications: NotificationItem[];
  initialUnreadCount: number;
  /** Admin navegando dentro da área de professor/aluno: mostra o botão de
   * volta para o painel admin. */
  showAdminSwitch?: boolean;
}

/**
 * Navegação da área logada (professor/aluno). Duas peças com o mesmo mapa de
 * rotas, cada uma para um tamanho de tela — mesmo modelo do rail hover-expand
 * usado no sistema irmão, aqui na paleta clara navy/dourado do Du Inglês:
 *
 * - `Sidebar` (>= md): rail de 64px que expande no hover/foco, ocupando a
 *   altura inteira da tela (sem cabeçalho acima).
 * - `NavMobile` (< md): barra superior fina + gaveta lateral por toque.
 */
export function AppSidebar(props: SidebarProps) {
  return (
    <>
      {props.showAdminSwitch && (
        <div className="fixed right-4 top-4 z-50 hidden md:block">
          <RoleSwitch
            active="away"
            awayLabel={props.role === "teacher" ? "Professor" : "Aluno"}
            tone="light"
          />
        </div>
      )}
      <NavMobile {...props} />
      <Sidebar {...props} />
    </>
  );
}

function Sidebar({
  role,
  userId,
  email,
  fullName,
  avatarUrl,
  profile,
  initialNotifications,
  initialUnreadCount,
}: SidebarProps) {
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

  // Revelação em cascata dos rótulos (itens + títulos de seção) quando o
  // painel abre — mesmo comportamento em qualquer elemento marcado
  // `data-nav-label`, dentro ou fora da navegação.
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

  // Fio de luz dourado que acompanha o ponteiro na borda do rail.
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

  const sections = sectionsFor(role);

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
          "absolute inset-y-0 left-0 flex flex-col overflow-hidden border-r border-app-shell-border",
          "bg-app-shell text-app-shell-foreground transition-shadow duration-300",
          expanded && "shadow-[10px_0_40px_-10px_rgba(10,31,68,0.35)]",
        )}
      >
        <div
          ref={glowRef}
          aria-hidden
          style={{ opacity: 0, height: GLOW_HEIGHT }}
          className="pointer-events-none absolute right-0 top-0 w-[2px] rounded-full bg-gradient-to-b from-transparent via-gold-400 to-transparent shadow-[0_0_12px_2px_rgba(201,162,39,0.45)]"
        />

        {/* Largura fixa: só a máscara do painel se move, o conteúdo nunca reflui. */}
        <div className="flex h-full flex-col" style={{ width: PANEL_WIDTH }}>
          <div className="relative flex h-16 shrink-0 flex-col justify-center border-b border-app-shell-border px-3">
            <Brand labelled />
            <span
              data-nav-label
              style={{ opacity: 0 }}
              className="mt-0.5 whitespace-nowrap pl-12 text-[10px] uppercase tracking-[0.14em] text-app-shell-foreground/70"
            >
              Área do {role === "teacher" ? "professor" : "aluno"}
            </span>
          </div>

          <nav
            aria-label="Navegação principal"
            className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2"
          >
            {sections.map((section, index) => (
              <div key={section.id}>
                {index > 0 && <div className="my-1.5 h-px bg-app-shell-border" />}
                <p
                  data-nav-label
                  style={{ opacity: 0 }}
                  className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-app-shell-foreground/50"
                >
                  {section.label}
                </p>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          ROW_CLASS,
                          active
                            ? "font-medium text-app-shell-foreground"
                            : "text-app-shell-foreground/70 hover:bg-gold-400/15 hover:text-gold-300",
                        )}
                      >
                        {active && (
                          <motion.span
                            layoutId="app-sidebar-active-rail"
                            transition={{
                              type: "spring",
                              stiffness: 480,
                              damping: 38,
                              mass: 0.7,
                            }}
                            className="absolute inset-0 -z-10 rounded-2xl bg-gold-400/15"
                          />
                        )}
                        <span
                          aria-hidden
                          className={cn(
                            "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-gold-400",
                            "origin-center transition-transform duration-200",
                            active ? "scale-y-100" : "scale-y-0",
                          )}
                        />
                        <Icon
                          className={cn(
                            "h-[18px] w-[18px] flex-none transition-colors",
                            active
                              ? "text-gold-400"
                              : "text-app-shell-foreground/60 group-hover:text-gold-300",
                          )}
                        />
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

          <div className="border-t border-app-shell-border px-3 py-2">
            <NotificationBell
              userId={userId}
              initialNotifications={initialNotifications}
              initialUnreadCount={initialUnreadCount}
              variant="rail"
              theme="app"
              label="Notificações"
            />

            <UserMenu
              userId={userId}
              name={fullName}
              email={email}
              role={role}
              avatarUrl={avatarUrl}
              profile={profile}
              theme="app"
              securityHref="/seguranca"
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

const MOBILE_ROW_CLASS =
  "group relative flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 text-[15px] font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2 focus-visible:ring-offset-app-shell";

function NavMobile({
  role,
  userId,
  email,
  fullName,
  avatarUrl,
  profile,
  initialNotifications,
  initialUnreadCount,
  showAdminSwitch,
}: SidebarProps) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [routeAtOpen, setRouteAtOpen] = useState(pathname);
  const atual = itemAtivo(pathname);
  const sections = sectionsFor(role);

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
      <header className="z-30 flex h-14 shrink-0 items-center gap-2 border-b border-app-shell-border bg-app-shell/95 px-2 pt-[env(safe-area-inset-top,0px)] text-app-shell-foreground backdrop-blur md:hidden">
        <button
          type="button"
          onClick={abrir}
          aria-label="Abrir navegação"
          aria-expanded={open}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-app-shell-foreground/70 transition-colors hover:bg-app-shell-foreground/10 hover:text-app-shell-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
        >
          <MenuIcon className="h-6 w-6" />
        </button>

        <Brand compact />

        {atual && (
          <span className="ml-0.5 min-w-0 truncate text-sm font-semibold text-app-shell-foreground">
            {atual.label}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {showAdminSwitch && (
            <RoleSwitch
              active="away"
              awayLabel={role === "teacher" ? "Professor" : "Aluno"}
              collapsed
              tone="dark"
            />
          )}
          <NotificationBell
            userId={userId}
            initialNotifications={initialNotifications}
            initialUnreadCount={initialUnreadCount}
            theme="app"
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
              aria-label="Navegação principal"
              role="dialog"
              aria-modal="true"
              initial={reduceMotion ? { opacity: 0 } : { x: "-100%" }}
              animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { x: "-100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 40 }}
              className={cn(
                "absolute inset-y-0 left-0 flex flex-col border-r border-app-shell-border bg-app-shell text-app-shell-foreground shadow-2xl",
                DRAWER_CLASS,
              )}
            >
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-app-shell-border px-3 pt-[env(safe-area-inset-top,0px)]">
                <div className="flex h-14 w-full items-center justify-between gap-2">
                  <Brand />
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Fechar navegação"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-app-shell-foreground/70 transition-colors hover:bg-app-shell-foreground/10 hover:text-app-shell-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                  >
                    <CloseIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain px-2 py-2">
                {sections.map((section, index) => (
                  <div key={section.id}>
                    {index > 0 && <div className="my-1.5 h-px bg-app-shell-border" />}
                    <p className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-app-shell-foreground/50">
                      {section.label}
                    </p>
                    <div className="space-y-0.5">
                      {section.items.map((item) => {
                        const active = isActive(pathname, item.href);
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              MOBILE_ROW_CLASS,
                              active
                                ? "bg-gold-400/15 text-app-shell-foreground"
                                : "text-app-shell-foreground/70 hover:bg-gold-400/15 hover:text-gold-300 active:bg-gold-400/20",
                            )}
                          >
                            {active && (
                              <span
                                aria-hidden
                                className="absolute -left-2 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-gold-400"
                              />
                            )}
                            <Icon
                              className={cn(
                                "h-5 w-5 flex-none",
                                active ? "text-gold-400" : "text-app-shell-foreground/60",
                              )}
                              aria-hidden
                            />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="shrink-0 border-t border-app-shell-border px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]">
                <UserMenu
                  userId={userId}
                  name={fullName}
                  email={email}
                  role={role}
                  avatarUrl={avatarUrl}
                  profile={profile}
                  theme="app"
                  securityHref="/seguranca"
                />
              </div>
            </motion.nav>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
