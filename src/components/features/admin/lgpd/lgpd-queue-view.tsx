"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  anonymizeFromRequestAction,
  resolveLgpdRequestAction,
  startLgpdRequestAction,
} from "@/actions/admin/lgpd";
import { Button } from "@/components/ui/button";
import { FormBanner } from "@/components/ui/form-message";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ANONYMIZE_CONFIRMATION,
  DELETION_GRACE_DAYS,
  KIND_LABEL,
  OPEN_STATUSES,
  RESOLUTION_STATUSES,
  STATUS_LABEL,
  daysUntil,
  deletionAvailableAt,
  formatDate,
  type LgpdQueueItem,
} from "@/lib/lgpd/requests";

const ROLE_LABEL = {
  admin: "coordenação",
  teacher: "professor",
  student: "aluno",
} as const;

type Filter = "open" | "all";

export function LgpdQueueView({
  items,
  currentUserId,
}: {
  items: LgpdQueueItem[];
  currentUserId: string;
}) {
  const [filter, setFilter] = useState<Filter>("open");
  const openItems = items.filter((item) => OPEN_STATUSES.includes(item.status));
  const overdue = openItems.filter((item) => daysUntil(item.dueAt) < 0).length;
  const visible = filter === "open" ? openItems : items;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold">Pedidos LGPD</h1>
      <p className="mt-1 text-sm text-admin-foreground/70">
        Pedidos de titulares com protocolo. A LGPD dá 15 dias para responder (art. 19); a
        exclusão tem {DELETION_GRACE_DAYS} dias de carência para o titular desistir.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-admin-border p-0.5 text-sm">
          {(["open", "all"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={cn(
                "rounded-md px-3 py-1.5",
                filter === value
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              {value === "open"
                ? `Em aberto (${openItems.length})`
                : `Todos (${items.length})`}
            </button>
          ))}
        </div>
        {overdue > 0 && (
          <span className="rounded-full bg-destructive/15 px-3 py-1 text-sm font-medium text-destructive">
            {overdue} pedido(s) com prazo vencido
          </span>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="mt-8 text-sm text-admin-foreground/70">
          {filter === "open"
            ? "Nenhum pedido em aberto."
            : "Nenhum pedido registrado ainda."}
        </p>
      ) : (
        <ul className="mt-5 space-y-4">
          {visible.map((item) => (
            <QueueItem key={item.id} item={item} currentUserId={currentUserId} />
          ))}
        </ul>
      )}
    </div>
  );
}

function DueBadge({ dueAt }: { dueAt: string }) {
  const days = daysUntil(dueAt);
  const tone =
    days < 0
      ? "bg-destructive/15 text-destructive"
      : days <= 5
        ? "bg-gold-500/20 text-gold-700"
        : "bg-muted text-admin-foreground/70";
  const label =
    days < 0
      ? `vencido há ${Math.abs(days)} dia(s)`
      : days === 0
        ? "vence hoje"
        : `vence em ${days} dia(s)`;
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", tone)}>
      {label} · {formatDate(dueAt)}
    </span>
  );
}

function QueueItem({
  item,
  currentUserId,
}: {
  item: LgpdQueueItem;
  currentUserId: string;
}) {
  const open = OPEN_STATUSES.includes(item.status);
  const [error, setError] = useState<string | null>(null);
  const [starting, startTransition] = useTransition();

  function start() {
    setError(null);
    startTransition(async () => {
      const result = await startLgpdRequestAction(item.id);
      if (!result.success) setError(result.error.message);
    });
  }

  return (
    <li className="rounded-lg border border-admin-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{KIND_LABEL[item.kind]}</p>
          <p className="mt-0.5 text-sm text-admin-foreground/70">
            {item.protocol} · {item.requesterName}
            {item.requesterRole ? ` (${ROLE_LABEL[item.requesterRole]})` : ""} ·{" "}
            {item.requesterEmail}
          </p>
          <p className="mt-0.5 text-xs text-admin-foreground/60">
            Aberto em {formatDate(item.createdAt)}
            {item.handledByName ? ` · com ${item.handledByName}` : ""}
            {item.resolvedAt ? ` · concluído em ${formatDate(item.resolvedAt)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
            {STATUS_LABEL[item.status]}
          </span>
          {open && <DueBadge dueAt={item.dueAt} />}
        </div>
      </div>

      {item.details && (
        <p className="mt-3 whitespace-pre-line rounded-md bg-muted/60 p-3 text-sm">
          {item.details}
        </p>
      )}
      {item.resolution && (
        <p className="mt-3 whitespace-pre-line text-sm">
          <span className="font-medium">Resposta: </span>
          {item.resolution}
        </p>
      )}

      {open && (
        <div className="mt-4 space-y-4 border-t border-admin-border pt-4">
          {error && <FormBanner tone="error">{error}</FormBanner>}
          <div className="flex flex-wrap gap-2">
            {item.status === "open" && (
              <Button type="button" variant="outline" onClick={start} disabled={starting}>
                {starting ? "Assumindo…" : "Assumir pedido"}
              </Button>
            )}
            {item.requesterId && !item.requesterAnonymized && (
              <Link
                href={`/admin/usuarios/${item.requesterId}` as Route}
                className="inline-flex h-10 items-center rounded-md px-3 text-sm underline"
              >
                Abrir cadastro
              </Link>
            )}
          </div>

          {item.kind === "deletion" && (
            <AnonymizeForm item={item} isSelf={item.requesterId === currentUserId} />
          )}
          <ResolveForm item={item} />
        </div>
      )}
    </li>
  );
}

function ResolveForm({ item }: { item: LgpdQueueItem }) {
  const [state, formAction, isPending] = useActionState(resolveLgpdRequestAction, null);
  // Exclusão só termina "atendida" pela anonimização; aqui só recusa/parcial.
  const options = RESOLUTION_STATUSES.filter(
    (status) => !(item.kind === "deletion" && status === "fulfilled"),
  );
  const [status, setStatus] = useState<string>(options[0] ?? "rejected");

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="requestId" value={item.id} />
      <p className="text-sm font-medium">
        {item.kind === "deletion"
          ? "Recusar ou atender em parte"
          : "Responder e concluir"}
      </p>
      {state && !state.success && (
        <FormBanner tone="error">{state.error.message}</FormBanner>
      )}
      <div className="grid gap-2 sm:grid-cols-[200px_1fr]">
        <Select
          name="status"
          value={status}
          onChange={setStatus}
          tone="admin"
          aria-label="Resultado"
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {STATUS_LABEL[option]}
            </option>
          ))}
        </Select>
        <textarea
          name="resolution"
          rows={3}
          maxLength={2000}
          required
          placeholder="O que foi feito ou, se recusado, o motivo legal. O titular lê este texto."
          className="w-full rounded-md border border-admin-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Salvando…" : "Concluir pedido"}
      </Button>
    </form>
  );
}

function AnonymizeForm({ item, isSelf }: { item: LgpdQueueItem; isSelf: boolean }) {
  const [state, formAction, isPending] = useActionState(anonymizeFromRequestAction, null);
  const availableAt = deletionAvailableAt(item.createdAt);
  const waiting = availableAt.getTime() > Date.now();

  if (state?.success) {
    return (
      <div className="space-y-2">
        <FormBanner tone="success">Dados anonimizados.</FormBanner>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {state.data.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3"
    >
      <input type="hidden" name="requestId" value={item.id} />
      <p className="text-sm font-medium">Executar a exclusão (anonimização)</p>
      <p className="text-xs text-admin-foreground/70">
        Apaga nome, e-mail, CPF, telefone, nascimento, foto, dados do responsável,
        observações, mensagens e respostas de tarefas, e desativa o login para sempre.
        Frequência, notas e registros financeiros ficam, sem identificação. Não dá para
        desfazer.
      </p>
      {isSelf ? (
        <p className="text-sm">
          Outra pessoa da coordenação precisa executar a sua exclusão.
        </p>
      ) : waiting ? (
        <p className="text-sm">
          Disponível a partir de {formatDate(availableAt.toISOString())}, ao fim da
          carência de {DELETION_GRACE_DAYS} dias.
        </p>
      ) : (
        <>
          {state && !state.success && (
            <FormBanner tone="error">{state.error.message}</FormBanner>
          )}
          <label className="block text-xs">
            Digite <strong>{ANONYMIZE_CONFIRMATION}</strong> para confirmar
            <input
              name="confirmation"
              autoComplete="off"
              className="mt-1 block w-full max-w-xs rounded-md border border-admin-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <Button type="submit" variant="destructive" disabled={isPending}>
            {isPending ? "Anonimizando…" : "Anonimizar dados"}
          </Button>
        </>
      )}
    </form>
  );
}
