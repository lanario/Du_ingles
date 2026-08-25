"use client";

/**
 * Convite de novo usuário — painel lateral, no mesmo container dos detalhes
 * (`SidePanel`), para o admin não perder a lista de vista.
 *
 * O painel tem dois momentos: preencher (papel, nome, WhatsApp) e enviar.
 * O envio é manual de propósito: a plataforma não dispara mensagem nenhuma,
 * ela só monta o texto e abre a conversa no WhatsApp do próprio admin.
 *
 * O link em claro aparece uma única vez, aqui. O banco guarda só o hash
 * (ver `lib/invite-token.ts`), então fechar o painel sem enviar significa
 * gerar outro convite — e é isso mesmo que o aviso no rodapé diz.
 */

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { createInviteAction } from "@/actions/admin/invites";
import { SidePanel } from "@/components/ui/side-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormBanner } from "@/components/ui/form-message";
import {
  CheckIcon,
  CopyIcon,
  GraduationIcon,
  MessageIcon,
  ShieldIcon,
  UserIcon,
  type IconProps,
} from "@/components/ui/icons";
import { formatPhoneDisplay, formatPhoneInput } from "@/lib/phone";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/types/domain";
import type { ComponentType } from "react";
import { LogoLoader } from "@/components/ui/logo-loader";

const ROLES: { id: AppRole; label: string; hint: string; icon: ComponentType<IconProps> }[] = [
  { id: "student", label: "Aluno", hint: "Turmas e tarefas", icon: UserIcon },
  { id: "teacher", label: "Professor", hint: "Aulas e planos", icon: GraduationIcon },
  { id: "admin", label: "Admin", hint: "Acesso total", icon: ShieldIcon },
];

export function InviteUserPanel({
  open,
  onClose,
  defaultRole = "student",
}: {
  open: boolean;
  onClose: () => void;
  defaultRole?: AppRole;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createInviteAction, null);

  const [role, setRole] = useState<AppRole>(defaultRole);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);

  const invite = state?.success ? state.data : null;
  const fieldErrors = state && !state.success ? state.error.fields : undefined;

  // Um convite recém-criado já mudou o estado do servidor (e pode aparecer
  // em contagens); e ao fechar, a lista precisa refletir quem aceitou.
  useEffect(() => {
    if (invite) router.refresh();
  }, [invite, router]);

  function reset() {
    setFullName("");
    setPhone("");
    setRole(defaultRole);
    setSent(false);
  }

  function close() {
    onClose();
    // Espera a animação de saída antes de zerar, senão o painel "pisca" de
    // volta para o passo 1 enquanto ainda está visível.
    window.setTimeout(reset, 250);
  }

  return (
    <SidePanel
      open={open}
      onClose={close}
      title={invite ? "Convite pronto" : "Novo usuário"}
      subtitle={
        invite
          ? "Envie a mensagem pelo WhatsApp — o cadastro é preenchido pela pessoa."
          : "O convite vai pelo WhatsApp; quem preenche o cadastro é a própria pessoa."
      }
    >
      {invite ? (
        <InviteReady
          inviteUrl={invite.inviteUrl}
          whatsappUrl={invite.whatsappUrl}
          message={invite.message}
          phone={invite.phone}
          fullName={invite.fullName}
          role={invite.role}
          expiresAt={invite.expiresAt}
          sent={sent}
          onSent={() => setSent(true)}
          onInviteAnother={() => {
            reset();
            // `useActionState` não tem reset: recarregar a rota devolve o
            // painel ao passo 1 com o estado da action limpo.
            router.refresh();
          }}
          onClose={close}
        />
      ) : (
        <form action={formAction} className="flex min-h-full flex-col" noValidate>
          <div className="flex-1 space-y-5 px-4 py-5 sm:px-6">
            {state && !state.success && !state.error.fields && (
              <FormBanner tone="error">{state.error.message}</FormBanner>
            )}

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-admin-foreground">
                Papel na plataforma
              </legend>
              <input type="hidden" name="role" value={role} />
              <div className="grid grid-cols-3 gap-2">
                {ROLES.map((item) => (
                  <RoleOption
                    key={item.id}
                    {...item}
                    selected={role === item.id}
                    onSelect={() => setRole(item.id)}
                  />
                ))}
              </div>
              <p className="text-xs text-admin-foreground/55">
                Define o que a pessoa vê ao entrar. Só o admin pode alterar depois.
              </p>
            </fieldset>

            <div className="space-y-1.5">
              <Label htmlFor="invite-fullName" className="text-admin-foreground">
                Nome completo <span className="text-gold-600">*</span>
              </Label>
              <Input
                id="invite-fullName"
                name="fullName"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Ex.: Maria Silva"
                autoComplete="off"
                required
                className="border-admin-border bg-admin-background focus-visible:ring-gold-500"
              />
              <FieldError messages={fieldErrors?.["fullName"]} />
              <p className="text-xs text-admin-foreground/55">
                Usado no “Olá, …” da mensagem. A pessoa confirma no cadastro.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-phone" className="text-admin-foreground">
                WhatsApp <span className="text-gold-600">*</span>
              </Label>
              <div className="flex items-stretch gap-2">
                <span className="grid h-10 shrink-0 place-items-center rounded-md border border-admin-border bg-admin-muted px-3 text-sm font-medium text-admin-foreground/60">
                  +55
                </span>
                <Input
                  id="invite-phone"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(event) => setPhone(formatPhoneInput(event.target.value))}
                  placeholder="(21) 99999-8888"
                  autoComplete="off"
                  required
                  className="border-admin-border bg-admin-background focus-visible:ring-gold-500"
                />
              </div>
              <FieldError messages={fieldErrors?.["phone"]} />
              <p className="text-xs text-admin-foreground/55">
                Com DDD. É este número que recebe o link do cadastro.
              </p>
            </div>

            <div className="flex gap-3 rounded-xl border border-admin-border bg-admin-muted/60 p-3.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold-100 text-gold-700">
                <MessageIcon className="h-4 w-4" />
              </span>
              <p className="text-xs leading-relaxed text-admin-foreground/65">
                Nada é enviado automaticamente. Ao gerar, o WhatsApp abre com a
                mensagem pronta e <strong className="font-medium">você</strong> aperta
                enviar. O link vale 7 dias e serve uma única vez.
              </p>
            </div>
          </div>

          <PanelFooter>
            <button
              type="button"
              onClick={close}
              className="h-10 rounded-xl border border-admin-border px-4 text-sm font-medium text-admin-foreground/70 transition-colors hover:bg-admin-muted hover:text-admin-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
            >
              Cancelar
            </button>
            <PrimaryButton type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <LogoLoader size={16} label={null} />
                  Gerando…
                </>
              ) : (
                "Gerar convite"
              )}
            </PrimaryButton>
          </PanelFooter>
        </form>
      )}
    </SidePanel>
  );
}

function RoleOption({
  label,
  hint,
  icon: Icon,
  selected,
  onSelect,
}: {
  label: string;
  hint: string;
  icon: ComponentType<IconProps>;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
        selected
          ? "border-gold-400 bg-gold-50 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--gold-500)_35%,transparent)]"
          : "border-admin-border bg-admin-surface hover:border-gold-300 hover:bg-admin-muted/50",
      )}
    >
      <span
        className={cn(
          "grid h-7 w-7 place-items-center rounded-lg",
          selected ? "bg-gold-500/20 text-gold-700" : "bg-admin-muted text-admin-foreground/50",
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="text-sm font-medium text-admin-foreground">{label}</span>
      <span className="text-[11px] leading-tight text-admin-foreground/50">{hint}</span>
    </button>
  );
}

/** Rodapé fixo do painel — mesma ancoragem do modelo de referência. */
function PanelFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 flex shrink-0 items-center justify-end gap-3 border-t border-admin-border bg-admin-surface px-4 py-4 sm:px-6">
      {children}
    </div>
  );
}

function PrimaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold-600 to-gold-400 px-5 text-sm font-semibold text-admin-foreground",
        "shadow-[0_8px_24px_-12px_rgba(201,162,39,0.75)] transition-opacity hover:opacity-95",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 disabled:pointer-events-none disabled:opacity-60",
        className,
      )}
    >
      {children}
    </button>
  );
}

function InviteReady({
  inviteUrl,
  whatsappUrl,
  message,
  phone,
  fullName,
  role,
  expiresAt,
  sent,
  onSent,
  onInviteAnother,
  onClose,
}: {
  inviteUrl: string;
  whatsappUrl: string;
  message: string;
  phone: string;
  fullName: string;
  role: AppRole;
  expiresAt: string;
  sent: boolean;
  onSent: () => void;
  onInviteAnother: () => void;
  onClose: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const roleLabel = ROLES.find((item) => item.id === role)?.label ?? role;
  const expires = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(
    new Date(expiresAt),
  );

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-5 px-4 py-5 sm:px-6">
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-3 rounded-xl border border-gold-300 bg-gold-50 px-3.5 py-3"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold-500/20 text-gold-700">
            <CheckIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-admin-foreground">
              {fullName} · {roleLabel}
            </p>
            <p className="text-xs text-admin-foreground/60">
              {formatPhoneDisplay(phone)} · válido até {expires}
            </p>
          </div>
        </motion.div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-admin-foreground">Mensagem</p>
          <div className="rounded-xl rounded-tl-sm border border-admin-border bg-admin-muted/70 px-3.5 py-3">
            <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-admin-foreground/80">
              {message}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyChip value={message} label="Copiar mensagem" />
            <CopyChip value={inviteUrl} label="Copiar só o link" />
          </div>
        </div>

        <div className="rounded-xl border border-dashed border-admin-border px-3.5 py-3">
          <p className="text-xs leading-relaxed text-admin-foreground/60">
            Guarde agora se precisar: por segurança o link não fica salvo e não pode
            ser exibido de novo. Se ele se perder, gere um novo convite — o anterior
            deixa de funcionar.
          </p>
        </div>
      </div>

      <PanelFooter>
        <button
          type="button"
          onClick={onInviteAnother}
          className="h-10 rounded-xl border border-admin-border px-4 text-sm font-medium text-admin-foreground/70 transition-colors hover:bg-admin-muted hover:text-admin-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
        >
          Convidar outra
        </button>
        {sent ? (
          <PrimaryButton type="button" onClick={onClose}>
            Concluir
          </PrimaryButton>
        ) : (
          <WhatsAppLink href={whatsappUrl} onClick={onSent} />
        )}
      </PanelFooter>
    </div>
  );
}

/**
 * O botão que abre o WhatsApp precisa ser um link de verdade: `window.open`
 * programático é bloqueado como popup em parte dos navegadores, e um
 * `<a target="_blank">` sempre passa por vir de um clique real.
 */
function WhatsAppLink({ href, onClick }: { href: string; onClick: () => void }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold-600 to-gold-400 px-5 text-sm font-semibold text-admin-foreground shadow-[0_8px_24px_-12px_rgba(201,162,39,0.75)] transition-opacity hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
    >
      <MessageIcon className="h-4 w-4" />
      Abrir WhatsApp
    </a>
  );
}

function CopyChip({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Sem permissão de clipboard: o texto continua selecionável na tela.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
        copied
          ? "border-success text-success"
          : "border-admin-border text-admin-foreground/60 hover:border-gold-400 hover:text-gold-700",
      )}
    >
      {copied ? <CheckIcon className="h-3 w-3" /> : <CopyIcon className="h-3 w-3" />}
      {copied ? "Copiado" : label}
    </button>
  );
}
