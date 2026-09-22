"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  cancelLgpdRequestAction,
  createLgpdRequestAction,
  listMyLgpdRequestsAction,
} from "@/actions/shared/lgpd";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/ui/form-message";
import { Select } from "@/components/ui/select";
import { LogoLoader } from "@/components/ui/logo-loader";
import { cn } from "@/lib/utils";
import { openCookiePreferences, useConsent } from "@/lib/consent/client";
import {
  DELETION_GRACE_DAYS,
  KIND_HINT,
  KIND_LABEL,
  LGPD_REQUEST_KINDS,
  OPEN_STATUSES,
  STATUS_LABEL,
  formatDate,
  type LgpdRequestKind,
  type LgpdRequestView,
} from "@/lib/lgpd/requests";

type Theme = "app" | "admin";

/**
 * "Meus dados": os direitos do titular (LGPD art. 18) num lugar só. Cópia
 * rápida dos dados, cookies, qualquer outro pedido com protocolo e prazo, e o
 * acompanhamento desses pedidos.
 *
 * `requests` vem pronto das páginas `/meus-dados`; no modal de perfil (cliente)
 * ele não vem e o painel busca sozinho. Depois de abrir ou cancelar um pedido
 * a lista é recarregada aqui — `revalidatePath` não alcança um modal.
 */
export function LgpdPanel({
  theme = "app",
  requests: initialRequests,
}: {
  theme?: Theme;
  requests?: LgpdRequestView[];
}) {
  const [requests, setRequests] = useState<LgpdRequestView[] | null>(
    initialRequests ?? null,
  );
  const reload = useCallback(() => {
    void listMyLgpdRequestsAction()
      .then(setRequests)
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (initialRequests === undefined) reload();
  }, [initialRequests, reload]);
  const reduceMotion = useReducedMotion();
  const consent = useConsent();
  const classes = themeClasses(theme);

  const cookieStatus =
    consent === undefined
      ? null
      : consent === null
        ? "Você ainda não escolheu. Até escolher, só os cookies necessários são usados."
        : consent.choices.preferences
          ? `Preferências de tela: permitidas desde ${new Date(consent.decidedAt).toLocaleDateString("pt-BR")}.`
          : "Preferências de tela: recusadas. Só os cookies necessários são usados.";

  const cards: { key: string; content: ReactNode }[] = [
    {
      key: "export",
      content: (
        <>
          <h2 className={classes.heading}>Exportar meus dados</h2>
          <p className={cn("mt-1", classes.muted)}>
            Baixe na hora uma cópia dos seus dados pessoais registrados na plataforma, em
            formato JSON.
          </p>
          <a href="/api/lgpd/export" className="mt-4 inline-block">
            <Button type="button" variant="outline">
              Baixar meus dados
            </Button>
          </a>
        </>
      ),
    },
    {
      key: "cookies",
      content: (
        <>
          <h2 className={classes.heading}>Cookies neste navegador</h2>
          <p className={cn("mt-1", classes.muted)}>
            {cookieStatus ?? "Carregando…"} Retirar a permissão apaga na hora o que estava
            guardado.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={openCookiePreferences}
          >
            Gerenciar cookies
          </Button>
        </>
      ),
    },
    { key: "request", content: <RequestForm theme={theme} onChange={reload} /> },
    {
      key: "history",
      content: <RequestHistory theme={theme} requests={requests} onChange={reload} />,
    },
  ];

  return (
    <div className="max-w-xl space-y-6">
      {cards.map((card, index) =>
        theme === "admin" ? (
          <div key={card.key} className={classes.card}>
            {card.content}
          </div>
        ) : (
          <motion.div
            key={card.key}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: index * 0.04, ease: "easeOut" }}
            className={classes.card}
          >
            {card.content}
          </motion.div>
        ),
      )}
    </div>
  );
}

function RequestForm({ theme, onChange }: { theme: Theme; onChange: () => void }) {
  const [state, formAction, isPending] = useActionState(createLgpdRequestAction, null);
  useEffect(() => {
    if (state?.success) onChange();
  }, [state, onChange]);
  const [kind, setKind] = useState<LgpdRequestKind>("access");
  const classes = themeClasses(theme);
  const fields = state && !state.success ? state.error.fields : undefined;

  return (
    <>
      <h2 className={classes.heading}>Fazer um pedido</h2>
      <p className={cn("mt-1", classes.muted)}>
        Correção, exclusão da conta, informações sobre compartilhamento e os demais
        direitos da LGPD. Cada pedido recebe um protocolo e é respondido em até 15 dias.
      </p>

      {state?.success ? (
        <div className="mt-4">
          <FormBanner tone="success">
            Pedido {state.data.protocol} registrado. Prazo de resposta:{" "}
            {formatDate(state.data.dueAt)}.
            {state.data.kind === "deletion" &&
              ` Você pode desistir nos próximos ${DELETION_GRACE_DAYS} dias.`}
          </FormBanner>
        </div>
      ) : null}

      <form action={formAction} className="mt-4 space-y-3">
        {state && !state.success && (
          <FormBanner tone="error">{state.error.message}</FormBanner>
        )}

        <div className="space-y-1.5">
          <label htmlFor="lgpd-kind" className="text-sm font-medium">
            O que você precisa?
          </label>
          <Select
            id="lgpd-kind"
            name="kind"
            value={kind}
            onChange={(value) => setKind(value as LgpdRequestKind)}
            tone={theme}
          >
            {LGPD_REQUEST_KINDS.map((option) => (
              <option key={option} value={option}>
                {KIND_LABEL[option]}
              </option>
            ))}
          </Select>
          <p className={cn("text-xs", classes.muted)}>{KIND_HINT[kind]}</p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="lgpd-details" className="text-sm font-medium">
            Detalhes{" "}
            {["rectification", "automated_review", "other"].includes(kind)
              ? ""
              : "(opcional)"}
          </label>
          <textarea
            id="lgpd-details"
            name="details"
            rows={3}
            maxLength={2000}
            aria-invalid={fields?.["details"]?.length ? true : undefined}
            className={cn(
              "w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              fields?.["details"]?.length ? "border-destructive" : "border-border",
            )}
          />
        </div>

        <Button
          type="submit"
          variant={kind === "deletion" ? "destructive" : "primary"}
          disabled={isPending}
        >
          {isPending ? (
            <span className="inline-flex items-center gap-2">
              <LogoLoader size={16} label={null} />
              Enviando…
            </span>
          ) : kind === "deletion" ? (
            "Pedir a exclusão da conta"
          ) : (
            "Enviar pedido"
          )}
        </Button>
      </form>
    </>
  );
}

function RequestHistory({
  theme,
  requests,
  onChange,
}: {
  theme: Theme;
  requests: LgpdRequestView[] | null;
  onChange: () => void;
}) {
  const classes = themeClasses(theme);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function cancel(id: string) {
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      const result = await cancelLgpdRequestAction(id);
      if (!result.success) setError(result.error.message);
      else onChange();
      setPendingId(null);
    });
  }

  return (
    <>
      <h2 className={classes.heading}>Minhas solicitações</h2>
      {requests === null ? (
        <p className={cn("mt-1", classes.muted)}>Carregando…</p>
      ) : requests.length === 0 ? (
        <p className={cn("mt-1", classes.muted)}>Você ainda não fez nenhum pedido.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {error && <FormBanner tone="error">{error}</FormBanner>}
          {requests.map((request) => {
            const open = OPEN_STATUSES.includes(request.status);
            return (
              <li
                key={request.id}
                className={cn("rounded-lg border p-3", classes.border)}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">{KIND_LABEL[request.kind]}</p>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      open
                        ? "bg-gold-500/15 text-gold-700"
                        : "bg-muted text-muted-foreground",
                      request.status === "fulfilled" &&
                        "bg-emerald-500/15 text-emerald-700",
                    )}
                  >
                    {STATUS_LABEL[request.status]}
                  </span>
                </div>
                <p className={cn("mt-1 text-xs", classes.muted)}>
                  {request.protocol} · aberto em {formatDate(request.createdAt)}
                  {open
                    ? ` · resposta até ${formatDate(request.dueAt)}`
                    : request.resolvedAt
                      ? ` · concluído em ${formatDate(request.resolvedAt)}`
                      : ""}
                </p>
                {request.resolution && (
                  <p className="mt-2 whitespace-pre-line text-sm">{request.resolution}</p>
                )}
                {open && (
                  <button
                    type="button"
                    onClick={() => cancel(request.id)}
                    disabled={pendingId === request.id}
                    className={cn(
                      "mt-2 text-xs underline disabled:opacity-50",
                      classes.muted,
                    )}
                  >
                    {pendingId === request.id ? "Cancelando…" : "Desistir deste pedido"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function themeClasses(theme: Theme) {
  return theme === "admin"
    ? {
        card: "rounded-lg border border-admin-border p-4",
        border: "border-admin-border",
        muted: "text-sm text-admin-foreground/70",
        heading: "font-semibold",
      }
    : {
        card: "rounded-2xl border border-border bg-background p-5 shadow-[var(--shadow-card)]",
        border: "border-border",
        muted: "text-sm text-muted-foreground",
        heading: "font-semibold text-navy-900",
      };
}
