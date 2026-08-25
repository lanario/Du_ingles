"use client";

/**
 * Linha da lista de planos — mesma informação do cartão, em formato de tabela
 * para comparar preço e ocupação de muitos planos de uma vez. A grade de
 * colunas (`LIST_GRID`) é compartilhada com o cabeçalho em `PlansView`.
 */

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { onOpenClick } from "@/components/ui/detail-panel";
import { EyeIcon, PencilIcon, PowerIcon, SwapIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { CopyLinkButton, SeatMeter, SyncPill, VisibilityPill } from "./plans-visuals";
import {
  ACCENT_TONE,
  INTERVAL_LABEL,
  formatMoney,
  type StudentPlan,
} from "./plans-utils";
import { LoadingVeil } from "@/components/ui/logo-loader";

export const LIST_GRID =
  "grid grid-cols-[1.6fr_0.9fr_0.8fr_1fr_0.9fr_0.8fr_auto] items-center gap-3";

interface PlanListItemProps {
  plan: StudentPlan;
  busy: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onSync: () => void;
  onToggleActive: () => void;
}

export function PlanListItem({
  plan,
  busy,
  onOpen,
  onEdit,
  onSync,
  onToggleActive,
}: PlanListItemProps) {
  const reduceMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);

  const actions: ActionMenuItem[] = [
    { label: "Ver detalhes", icon: EyeIcon, onSelect: onOpen },
    { label: "Editar plano", icon: PencilIcon, tone: "accent", onSelect: onEdit },
    {
      label: plan.syncStatus === "synced" ? "Ressincronizar" : "Publicar na Stripe",
      icon: SwapIcon,
      onSelect: onSync,
    },
    {
      label: plan.isActive ? "Arquivar plano" : "Reativar plano",
      icon: PowerIcon,
      tone: plan.isActive ? "danger" : "accent",
      separated: true,
      onSelect: onToggleActive,
    },
  ];

  return (
    <motion.div
      layout
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      onClick={onOpenClick(onOpen)}
      className={cn(
        LIST_GRID,
        "cursor-pointer border-b border-admin-border bg-admin-surface px-4 py-3 text-sm transition-colors last:border-0",
        "hover:bg-admin-muted/60",
        menuOpen && "relative z-20",
        busy && "relative pointer-events-none",
        !plan.isActive && "opacity-70",
      )}
    >
      {busy && <LoadingVeil label={null} size={22} />}
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden
          style={{ backgroundColor: ACCENT_TONE[plan.accent] }}
          className="h-8 w-1 shrink-0 rounded-full"
        />
        <div className="min-w-0">
          <p className="truncate font-medium text-admin-foreground">{plan.name}</p>
          <p className="truncate text-xs text-admin-foreground/50">
            {plan.headline ?? `${plan.features.length} benefícios`}
          </p>
        </div>
      </div>

      <div className="font-semibold tabular text-admin-foreground">
        {formatMoney(plan.priceCents, plan.currency)}
      </div>

      <div className="truncate text-admin-foreground/60">
        {INTERVAL_LABEL[plan.billingInterval]}
      </div>

      {plan.seatLimit === null ? (
        <div className="text-admin-foreground/60 tabular">
          {plan.activeSubscribers}{" "}
          <span className="text-admin-foreground/35">
            {plan.activeSubscribers === 1 ? "assinante" : "assinantes"}
          </span>
        </div>
      ) : (
        <SeatMeter plan={plan} />
      )}

      <div className="flex flex-wrap gap-1.5">
        <SyncPill plan={plan} />
      </div>

      <div className="flex min-w-0 items-center gap-1">
        <VisibilityPill plan={plan} />
        {plan.stripePaymentLinkUrl && (
          <CopyLinkButton url={plan.stripePaymentLinkUrl} label="" className="px-1" />
        )}
      </div>

      <ActionMenu
        items={actions}
        disabled={busy}
        onOpenChange={setMenuOpen}
        label={`Ações do plano ${plan.name}`}
      />
    </motion.div>
  );
}
