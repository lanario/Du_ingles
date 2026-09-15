"use client";

/**
 * Cartão da conta no rodapé da sidebar: foto, nome e papel, com um menu que
 * sobe ao clique (Meu Perfil, Segurança, Sair). Substitui o par "e-mail solto
 * + botão Sair" que existia antes nas duas barras.
 *
 * O painel do menu vai para um portal no `body` com posição fixa: o rail tem
 * `overflow-hidden` (é o que mascara a animação de largura), então qualquer
 * popover ancorado dentro dele seria cortado com a barra recolhida.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/actions/auth/logout";
import { AccountAvatar } from "@/components/features/account/account-avatar";
import { SecurityModal } from "@/components/features/account/security-modal";
import { ProfileModal } from "@/components/features/account/profile-modal";
import { ChevronIcon, KeyIcon, LogoutIcon, UserIcon } from "@/components/ui/icons";
import type { AppRole } from "@/types/domain";
import type { MyProfile } from "@/repositories/users";

const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Administrador",
  teacher: "Professor",
  student: "Aluno",
};

const MENU_WIDTH = 264;
const GAP = 10;

interface UserMenuProps {
  userId: string;
  name: string;
  email: string;
  role: AppRole;
  avatarUrl: string | null;
  /** `app` = rail navy; `admin` = rail dourado. Muda só o cartão-gatilho. */
  theme: "app" | "admin";
  /** Dados do formulário de "Meu Perfil" — `null` só se a leitura falhar. */
  profile: MyProfile | null;
  /** Rail recolhido mostra só a foto; a gaveta do mobile é sempre larga. */
  compact?: boolean;
  className?: string;
  /**
   * Avisa quem chama quando o menu OU um dos modais (Meu Perfil, Segurança)
   * abre/fecha. O rail hover-expand escuta isto para reconferir seu próprio
   * estado ao fechar — tudo isto vai para um portal fora do DOM do rail,
   * então abrir/fechar um deles pode acontecer sem que o rail veja o
   * ponteiro ou o foco saírem de verdade, e ele fica "travado" expandido.
   */
  onOpenChange?: (open: boolean) => void;
}

export function UserMenu({
  userId,
  name,
  email,
  role,
  avatarUrl,
  theme,
  profile,
  compact = false,
  className,
  onOpenChange,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [coords, setCoords] = useState<{ left: number; bottom: number } | null>(null);
  const [loggingOut, startLogout] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const left = Math.min(
      Math.max(8, rect.left),
      Math.max(8, window.innerWidth - MENU_WIDTH - 8),
    );
    setCoords({ left, bottom: window.innerHeight - rect.top + GAP });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  // O rail hover-expand reconfere seu próprio hover/foco sempre que este menu
  // ou um dos modais que ele abre (Meu Perfil, Segurança) fecha — não só o
  // dropdown em si, senão fechar um modal (ex.: clicando fora dele) deixava o
  // rail travado expandido, já que nada mais avisava essa transição.
  const anyOpen = open || securityOpen || profileOpen;
  useEffect(() => {
    onOpenChange?.(anyOpen);
  }, [anyOpen, onOpenChange]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    const onReflow = () => place();

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open, place]);

  const menu =
    typeof document === "undefined"
      ? null
      : createPortal(
          <AnimatePresence>
            {open && coords && (
              <motion.div
                ref={menuRef}
                role="menu"
                aria-label="Menu da conta"
                initial={reduceMotion ? false : { opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.98 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  position: "fixed",
                  left: coords.left,
                  bottom: coords.bottom,
                  width: MENU_WIDTH,
                  zIndex: 80,
                }}
                className="origin-bottom overflow-hidden rounded-2xl border border-border bg-white shadow-[0_18px_50px_-12px_rgba(10,31,68,0.35)]"
              >
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <AccountAvatar
                    id={userId}
                    name={name || email}
                    src={avatarUrl}
                    size="md"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-navy-900">
                      {name || email}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{email}</p>
                  </div>
                </div>

                <div className="h-px bg-border" />

                <div className="p-1.5">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      setProfileOpen(true);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left text-sm font-medium text-navy-900 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  >
                    <UserIcon className="h-[18px] w-[18px] text-navy-900/60" />
                    Meu Perfil
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      setSecurityOpen(true);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left text-sm font-medium text-navy-900 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  >
                    <KeyIcon className="h-[18px] w-[18px] text-navy-900/60" />
                    Segurança
                  </button>
                </div>

                <div className="h-px bg-border" />

                <div className="p-1.5">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={loggingOut}
                    onClick={() =>
                      startLogout(async () => {
                        await logoutAction();
                      })
                    }
                    className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium text-navy-900 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
                  >
                    <LogoutIcon className="h-[18px] w-[18px] text-navy-900/60" />
                    {loggingOut ? "Saindo…" : "Sair"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "group flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          theme === "app"
            ? "hover:bg-white/10 focus-visible:ring-gold-400 focus-visible:ring-offset-app-shell"
            : "hover:bg-navy-900/10 focus-visible:ring-navy-900 focus-visible:ring-offset-admin-shell",
          open && (theme === "app" ? "bg-white/10" : "bg-navy-900/10"),
          className,
        )}
        onClick={() => setOpen((value) => !value)}
      >
        <AccountAvatar id={userId} name={name || email} src={avatarUrl} size="sm" />

        <span
          data-nav-label={compact ? "" : undefined}
          style={compact ? { opacity: 0 } : undefined}
          className="min-w-0 flex-1 overflow-hidden"
        >
          <span
            className={cn(
              "block truncate whitespace-nowrap text-sm font-medium",
              theme === "app"
                ? "text-app-shell-foreground"
                : "text-admin-shell-foreground",
            )}
          >
            {name || email}
          </span>
          <span
            className={cn(
              "block truncate whitespace-nowrap text-xs",
              theme === "app"
                ? "text-app-shell-foreground/60"
                : "text-admin-shell-foreground/70",
            )}
          >
            {ROLE_LABEL[role]}
          </span>
        </span>

        <ChevronIcon
          data-nav-label={compact ? "" : undefined}
          style={compact ? { opacity: 0 } : undefined}
          className={cn(
            "h-4 w-4 flex-none transition-transform",
            open ? "rotate-90" : "-rotate-90",
            theme === "app"
              ? "text-app-shell-foreground/60"
              : "text-admin-shell-foreground/70",
          )}
        />
      </button>

      {menu}

      {typeof document !== "undefined" &&
        createPortal(
          <>
            <SecurityModal
              open={securityOpen}
              onClose={() => setSecurityOpen(false)}
              theme={theme}
              onOpenProfile={() => {
                setSecurityOpen(false);
                setProfileOpen(true);
              }}
            />
            <ProfileModal
              open={profileOpen}
              onClose={() => setProfileOpen(false)}
              theme={theme}
              profile={profile}
              avatarUrl={avatarUrl}
            />
          </>,
          document.body,
        )}
    </>
  );
}
