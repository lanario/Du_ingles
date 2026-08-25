"use client";

/**
 * Uma linha do livro-caixa.
 *
 * A linha carrega as duas ações que respondem por quase todo o uso da tela —
 * dar baixa e trocar a forma de pagamento — sem abrir formulário nenhum.
 * Editar, estornar e excluir ficam no menu "⋮", que é o padrão das outras
 * listas do painel.
 */

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { onOpenClick } from "@/components/ui/detail-panel";
import { Select } from "@/components/ui/select";
import {
  ArrowInIcon,
  ArrowOutIcon,
  CheckIcon,
  PencilIcon,
  SwapIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from "@/schemas/finance";
import { StatePill } from "./finance-visuals";
import {
  DIRECTION_COPY,
  DIRECTION_TONE,
  categoryLabel,
  entryState,
  formatDate,
  formatMoney,
  type FinanceEntry,
} from "./finance-utils";
import { LoadingVeil, LogoLoader } from "@/components/ui/logo-loader";

interface EntryRowProps {
  entry: FinanceEntry;
  today: string;
  busy: boolean;
  onEdit: () => void;
  onSettle: () => void;
  onReopen: () => void;
  onDelete: () => void;
  onMethodChange: (method: string) => void;
}

export function EntryRow({
  entry,
  today,
  busy,
  onEdit,
  onSettle,
  onReopen,
  onDelete,
  onMethodChange,
}: EntryRowProps) {
  const reduceMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);

  const state = entryState(entry, today);
  const settled = state === "paid";
  const tone = DIRECTION_TONE[entry.direction];
  const copy = DIRECTION_COPY[entry.direction];
  const Icon = entry.direction === "in" ? ArrowInIcon : ArrowOutIcon;

  const actions: ActionMenuItem[] = [
    { label: "Editar lançamento", icon: PencilIcon, tone: "accent", onSelect: onEdit },
    settled
      ? { label: "Estornar baixa", icon: SwapIcon, onSelect: onReopen }
      : {
          label: `Marcar como ${entry.direction === "in" ? "recebido" : "pago"}`,
          icon: CheckIcon,
          onSelect: onSettle,
        },
    {
      label: "Excluir",
      icon: TrashIcon,
      tone: "danger",
      separated: true,
      onSelect: onDelete,
    },
  ];

  return (
    <motion.div
      layout
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      onClick={onOpenClick(onEdit)}
      className={cn(
        "group relative flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-2.5 border-b border-admin-border px-3 py-3 transition-colors last:border-0 sm:px-4",
        "hover:bg-admin-muted/50",
        menuOpen && "relative z-20",
        busy && "relative pointer-events-none",
      )}
    >
      {busy && <LoadingVeil label={null} size={22} />}
      <span
        aria-hidden
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
        style={{
          backgroundColor: `color-mix(in srgb, ${tone} 11%, #ffffff)`,
          color: tone,
        }}
      >
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-[8rem] flex-1">
        <p className="truncate text-sm font-medium text-admin-foreground">
          {entry.description}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-admin-foreground/50">
          <span>{categoryLabel(entry)}</span>
          <span aria-hidden>·</span>
          <span className={cn(state === "overdue" && "font-semibold text-destructive")}>
            venc. {formatDate(entry.dueOn)}
          </span>
          {entry.counterparty && (
            <>
              <span aria-hidden>·</span>
              <span className="truncate">{entry.counterparty}</span>
            </>
          )}
          {settled && entry.paidOn && (
            <>
              <span aria-hidden>·</span>
              <span className="text-success">
                {entry.direction === "in" ? "recebido" : "pago"} em{" "}
                {formatDate(entry.paidOn)}
              </span>
            </>
          )}
        </p>
      </div>

      <div className="ml-auto flex flex-col items-end sm:ml-0">
        <span className="text-sm font-semibold tabular" style={{ color: tone }}>
          {entry.direction === "in" ? "+" : "−"}
          {formatMoney(entry.amountCents)}
        </span>
        <StatePill entry={entry} today={today} className="mt-1" />
      </div>

      <div className="flex w-full items-center gap-2 sm:w-auto">
        <Select
          tone="admin"
          value={entry.paymentMethod ?? ""}
          onChange={onMethodChange}
          disabled={busy}
          aria-label={`Forma de pagamento de ${entry.description}`}
          className="h-9 w-full min-w-0 flex-1 bg-admin-background text-[13px] sm:w-[9.5rem] sm:flex-none"
          placeholder="Forma"
        >
          <option value="">Não informada</option>
          {PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>
              {PAYMENT_METHOD_LABEL[method]}
            </option>
          ))}
        </Select>

        <button
          type="button"
          onClick={settled ? onReopen : onSettle}
          disabled={busy}
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 disabled:opacity-60",
            settled
              ? "border border-admin-border text-admin-foreground/60 hover:border-gold-300 hover:text-admin-foreground"
              : "text-white",
          )}
          style={settled ? undefined : { backgroundColor: "var(--success)" }}
        >
          {busy ? (
            <LogoLoader size={14} label={null} />
          ) : settled ? (
            <SwapIcon className="h-3.5 w-3.5" />
          ) : (
            <CheckIcon className="h-3.5 w-3.5" />
          )}
          {settled ? "Estornar" : copy.settle}
        </button>

        <ActionMenu
          items={actions}
          disabled={busy}
          onOpenChange={setMenuOpen}
          label={`Ações do lançamento ${entry.description}`}
        />
      </div>
    </motion.div>
  );
}
