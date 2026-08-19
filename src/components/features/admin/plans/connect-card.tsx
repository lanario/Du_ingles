"use client";

/**
 * Cartão do Stripe Connect — o estado da conta que recebe o dinheiro.
 *
 * Fica no topo da página e não numa aba de configurações porque é
 * pré-requisito de tudo o que vem abaixo: sem conta habilitada, nenhum plano
 * pode ser publicado, e descobrir isso só depois de desenhar três planos
 * seria frustrante. Por isso ele muda de forma conforme o estágio — faixa
 * discreta quando está tudo certo, chamada grande quando falta agir.
 *
 * O anel de progresso é GSAP (desenho contínuo, amarrado ao valor) e a troca
 * entre estágios é Framer (ciclo de vida do React). As duas nunca tocam o
 * mesmo nó.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import gsap from "gsap";
import {
  openConnectDashboardAction,
  refreshConnectAccountAction,
  saveConnectSettingsAction,
  startConnectOnboardingAction,
} from "@/actions/admin/student-plans";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  CheckIcon,
  ClockIcon,
  EyeIcon,
  ShieldIcon,
  SpinnerIcon,
  SwapIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { ConnectAccount } from "@/repositories/stripe-connect";

/**
 * Os três estágios pelos quais uma conta conectada passa. O rótulo é o que o
 * admin lê; a decisão de qual mostrar vem só de `chargesEnabled` e da
 * existência da conta — nada de inferir estágio a partir de `requirements`,
 * que muda de formato conforme o país.
 */
type Stage = "none" | "pending" | "ready";

function stageOf(account: ConnectAccount | null): Stage {
  if (!account) return "none";
  return account.chargesEnabled ? "ready" : "pending";
}

/** Progresso do onboarding, em três marcos verificáveis. */
function progressOf(account: ConnectAccount | null): number {
  if (!account) return 0;
  let done = 1; // conta criada
  if (account.detailsSubmitted) done += 1;
  if (account.chargesEnabled) done += 1;
  return done / 3;
}

interface ConnectCardProps {
  account: ConnectAccount | null;
  /** `false` quando `STRIPE_SECRET_KEY` não existe no ambiente. */
  configured: boolean;
  /** `true` com chave `sk_live_` — a faixa de "modo de teste" some. */
  liveMode: boolean;
}

export function ConnectCard({ account, configured, liveMode }: ConnectCardProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const stage = stageOf(account);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  /** Toda ação do Connect devolve URL ou erro — o tratamento é sempre este. */
  function run(
    action: () => Promise<
      { success: true; data: { url: string } | never } | { success: false; error: { message: string } }
    >,
    navigate: boolean,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      if (navigate && "url" in result.data) {
        // O link do Connect é de uso único e expira em minutos; abrir na mesma
        // aba evita que ele morra num aba de fundo esquecida.
        window.location.href = result.data.url;
        return;
      }
      router.refresh();
    });
  }

  if (!configured) {
    return (
      <Shell tone="var(--warning)" icon={ShieldIcon}>
        <p className="text-sm font-semibold text-admin-foreground">
          Stripe não configurada neste ambiente
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-admin-foreground/60">
          Defina <code className="font-mono text-[12px]">STRIPE_SECRET_KEY</code> e{" "}
          <code className="font-mono text-[12px]">STRIPE_WEBHOOK_SECRET</code> no
          ambiente. Enquanto isso, os planos podem ser desenhados e salvos como
          rascunho — nada é cobrado.
        </p>
      </Shell>
    );
  }

  return (
    <div className="space-y-2">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={stage}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        >
          {stage === "ready" ? (
            <ReadyBar
              account={account!}
              liveMode={liveMode}
              pending={pending}
              onDashboard={() => run(openConnectDashboardAction, true)}
              onRefresh={() => run(refreshConnectAccountAction, false)}
              onSettings={() => setSettingsOpen((open) => !open)}
              settingsOpen={settingsOpen}
            />
          ) : (
            <OnboardingCall
              account={account}
              progress={progressOf(account)}
              pending={pending}
              onStart={() => run(startConnectOnboardingAction, true)}
              onRefresh={() => run(refreshConnectAccountAction, false)}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] text-destructive"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {settingsOpen && account && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <ConnectSettings account={account} onSaved={() => router.refresh()} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Estágios
// ---------------------------------------------------------------------------

/** Faixa fina do estado "tudo certo": informa sem ocupar a tela. */
function ReadyBar({
  account,
  liveMode,
  pending,
  onDashboard,
  onRefresh,
  onSettings,
  settingsOpen,
}: {
  account: ConnectAccount;
  liveMode: boolean;
  pending: boolean;
  onDashboard: () => void;
  onRefresh: () => void;
  onSettings: () => void;
  settingsOpen: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-admin-border bg-admin-surface px-4 py-3">
      <span
        aria-hidden
        style={{
          color: "var(--success)",
          backgroundColor: "color-mix(in srgb, var(--success) 12%, #ffffff)",
        }}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
      >
        <CheckIcon className="h-4.5 w-4.5" strokeWidth={2.2} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-admin-foreground">
          Stripe Connect ativo
          {!liveMode && (
            <span className="rounded-full bg-[color-mix(in_srgb,var(--warning)_12%,#ffffff)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--warning)]">
              modo de teste
            </span>
          )}
          {!account.payoutsEnabled && (
            <span className="rounded-full bg-[color-mix(in_srgb,var(--warning)_12%,#ffffff)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--warning)]">
              repasses ainda bloqueados
            </span>
          )}
        </p>
        <p className="mt-0.5 truncate text-[12px] text-admin-foreground/55">
          {account.businessName ?? "Conta conectada"} ·{" "}
          <span className="font-mono">{account.stripeAccountId}</span> ·{" "}
          {account.chargeModel === "destination"
            ? `cobrança na plataforma, repasse automático${
                account.applicationFeePercent > 0
                  ? ` (comissão ${account.applicationFeePercent}%)`
                  : ""
              }`
            : "cobrança direta na conta da escola"}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <BarButton icon={SwapIcon} label="Atualizar" onClick={onRefresh} busy={pending} />
        <BarButton icon={EyeIcon} label="Dashboard" onClick={onDashboard} busy={pending} />
        <BarButton
          icon={ShieldIcon}
          label={settingsOpen ? "Fechar ajustes" : "Ajustes"}
          onClick={onSettings}
          busy={false}
        />
      </div>
    </div>
  );
}

/**
 * Chamada grande dos estágios incompletos. O anel mostra quanto do caminho
 * já foi andado — sem ele, "conta criada mas em análise" e "nada feito"
 * pareceriam o mesmo bloqueio.
 */
function OnboardingCall({
  account,
  progress,
  pending,
  onStart,
  onRefresh,
}: {
  account: ConnectAccount | null;
  progress: number;
  pending: boolean;
  onStart: () => void;
  onRefresh: () => void;
}) {
  const due = account?.requirementsDue ?? [];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gold-300 bg-gradient-to-br from-gold-50 via-admin-surface to-admin-surface p-5">
      <div className="flex flex-wrap items-start gap-5">
        <ProgressRing value={progress} />

        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-admin-foreground">
            {account
              ? "Onboarding da Stripe em andamento"
              : "Conecte a conta que vai receber os pagamentos"}
          </p>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-admin-foreground/65">
            {account
              ? "A conta foi criada, mas a Stripe ainda não liberou as cobranças. Complete os dados pendentes para publicar planos e vender assinaturas."
              : "As assinaturas dos alunos são cobradas pela plataforma Du Inglês e repassadas automaticamente para a conta da escola. O cadastro é feito na própria Stripe — nenhum dado bancário passa por aqui."}
          </p>

          {due.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {due.slice(0, 6).map((item) => (
                <li
                  key={item}
                  className="rounded-lg bg-[color-mix(in_srgb,var(--warning)_10%,#ffffff)] px-2 py-1 font-mono text-[11px] text-[color:var(--warning)]"
                >
                  {item}
                </li>
              ))}
              {due.length > 6 && (
                <li className="px-2 py-1 text-[11px] text-admin-foreground/45">
                  + {due.length - 6}
                </li>
              )}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onStart}
              disabled={pending}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity",
                "bg-gradient-to-r from-navy-800 to-navy-600 text-white",
                "hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {pending ? (
                <SpinnerIcon className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldIcon className="h-4 w-4" />
              )}
              {account ? "Continuar onboarding" : "Conectar com a Stripe"}
            </button>

            {account && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-xl border border-admin-border bg-admin-surface px-4 py-2.5 text-sm font-medium text-admin-foreground/70 transition-colors hover:bg-admin-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 disabled:opacity-50"
              >
                <SwapIcon className="h-4 w-4" />
                Já concluí — atualizar status
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Anel de progresso. `pathLength={1}` faz o `strokeDashoffset` ser a própria
 * fração — sem contas com raio — e o GSAP anima só esse número.
 */
function ProgressRing({ value }: { value: number }) {
  const ref = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      gsap.set(el, { strokeDashoffset: 1 - value });
      return;
    }

    const tween = gsap.fromTo(
      el,
      { strokeDashoffset: 1 },
      { strokeDashoffset: 1 - value, duration: 1, ease: "power3.out" },
    );
    return () => {
      tween.kill();
    };
  }, [value]);

  const steps = Math.round(value * 3);

  return (
    <div className="relative h-[76px] w-[76px] shrink-0" role="img" aria-label={`${steps} de 3 etapas concluídas`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r="44" fill="none" stroke="var(--admin-muted)" strokeWidth={6} />
        <circle
          ref={ref}
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke="var(--gold-500)"
          strokeWidth={6}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-[15px] font-semibold tabular text-gold-700">{steps}</span>
        <span className="mt-0.5 text-[10px] text-admin-foreground/45">de 3</span>
      </span>
    </div>
  );
}

function BarButton({
  icon: Icon,
  label,
  onClick,
  busy,
}: {
  icon: typeof SwapIcon;
  label: string;
  onClick: () => void;
  busy: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-admin-foreground/60 transition-colors hover:bg-admin-muted hover:text-admin-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 disabled:opacity-50"
    >
      {busy ? <SpinnerIcon className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Ajustes comerciais
// ---------------------------------------------------------------------------

/**
 * Modelo de cobrança e comissão. Fica escondido atrás de "Ajustes" porque é
 * decisão que se toma uma vez e não se revisita — e porque mexer nela sem
 * entender o Connect quebra o fluxo de repasse.
 */
function ConnectSettings({
  account,
  onSaved,
}: {
  account: ConnectAccount;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [model, setModel] = useState(account.chargeModel);

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 2400);
    return () => window.clearTimeout(timer);
  }, [saved]);

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await saveConnectSettingsAction(null, formData);
      if (result.success) {
        setSaved(true);
        onSaved();
      }
    });
  }

  return (
    <form
      action={submit}
      className="rounded-2xl border border-admin-border bg-admin-surface p-4"
    >
      <div className="grid gap-4 sm:grid-cols-[1.4fr_0.8fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="connect-model" className="text-admin-foreground">
            Modelo de cobrança
          </Label>
          <Select
            id="connect-model"
            name="chargeModel"
            tone="admin"
            value={model}
            onChange={(next) => setModel(next as typeof model)}
          >
            <option value="destination">
              Na plataforma, com repasse automático (recomendado)
            </option>
            <option value="direct">Direto na conta da escola</option>
          </Select>
          <p className="text-[11px] leading-snug text-admin-foreground/50">
            {model === "destination"
              ? "Clientes, faturas e disputas ficam na conta da plataforma; o líquido é transferido para a escola."
              : "A cobrança nasce na conta da escola, que assume as taxas da Stripe e a relação com o cliente."}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="connect-fee" className="text-admin-foreground">
            Comissão da plataforma
          </Label>
          <div className="relative">
            <Input
              id="connect-fee"
              name="applicationFeePercent"
              defaultValue={String(account.applicationFeePercent).replace(".", ",")}
              inputMode="decimal"
              className="border-admin-border bg-admin-background pr-8 tabular focus-visible:ring-gold-500"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-admin-foreground/40">
              %
            </span>
          </div>
          <p className="text-[11px] text-admin-foreground/50">Vale só para assinaturas novas.</p>
        </div>

        <button
          type="submit"
          disabled={pending}
          className={cn(
            "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors",
            saved
              ? "bg-[color-mix(in_srgb,var(--success)_14%,#ffffff)] text-[color:var(--success)]"
              : "bg-gradient-to-r from-navy-800 to-navy-600 text-white hover:opacity-90",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 disabled:opacity-50",
          )}
        >
          {pending ? (
            <SpinnerIcon className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <CheckIcon className="h-4 w-4" />
          ) : null}
          {saved ? "Salvo" : "Salvar"}
        </button>
      </div>
    </form>
  );
}

/** Moldura das mensagens de estado que não são o fluxo normal do Connect. */
function Shell({
  tone,
  icon: Icon,
  children,
}: {
  tone: string;
  icon: typeof ClockIcon;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex gap-4 rounded-2xl border p-4"
      style={{
        borderColor: `color-mix(in srgb, ${tone} 32%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${tone} 6%, #ffffff)`,
      }}
    >
      <span
        aria-hidden
        style={{ color: tone, backgroundColor: `color-mix(in srgb, ${tone} 12%, #ffffff)` }}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
      >
        <Icon className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
