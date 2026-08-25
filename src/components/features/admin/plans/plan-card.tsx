"use client";

/**
 * Cartão de um plano. Mesma anatomia dos cartões de turma e usuário (framer
 * motion para layout/hover, `ActionMenu` no canto, véu de acento no hover),
 * com o preço no lugar do avatar — numa lista de planos o que se procura é
 * quanto custa, não quem é.
 *
 * O plano em destaque ganha uma borda no tom do acento e sobe um degrau na
 * grade: é o mesmo destaque que o aluno vai ver na vitrine, então o admin
 * enxerga aqui exatamente o que publicou.
 */

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { onOpenClick } from "@/components/ui/detail-panel";
import {
  CheckIcon,
  CopyIcon,
  EyeIcon,
  PencilIcon,
  PowerIcon,
  SwapIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import {
  AccentAura,
  BadgePill,
  CopyLinkButton,
  FeatureList,
  IntervalPill,
  PriceTag,
  SeatMeter,
  SyncPill,
  VisibilityPill,
} from "./plans-visuals";
import { ACCENT_TONE, type StudentPlan } from "./plans-utils";
import { LoadingVeil } from "@/components/ui/logo-loader";

interface PlanCardProps {
  plan: StudentPlan;
  busy: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onSync: () => void;
  onToggleActive: () => void;
}

export function PlanCard({
  plan,
  busy,
  onOpen,
  onEdit,
  onSync,
  onToggleActive,
}: PlanCardProps) {
  const reduceMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const tone = ACCENT_TONE[plan.accent];

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
    <motion.article
      layout
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.8 }}
      whileHover={reduceMotion ? undefined : { y: -4 }}
      onClick={onOpenClick(onOpen)}
      className={cn(
        "group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border p-5 transition-colors duration-300",
        "bg-admin-surface",
        "shadow-[0_1px_2px_rgba(11,26,51,0.04),0_10px_30px_-20px_rgba(11,26,51,0.4)]",
        plan.isFeatured ? "border-transparent" : "border-admin-border hover:border-gold-300",
        menuOpen && "z-20",
        busy && "relative pointer-events-none",
        !plan.isActive && "opacity-75",
      )}
      style={
        plan.isFeatured
          ? { boxShadow: `0 0 0 1.5px ${tone}, 0 18px 40px -28px ${tone}` }
          : undefined
      }
    >
      {busy && <LoadingVeil label={null} size={40} className="rounded-2xl" />}
      <AccentAura accent={plan.accent} />

      {/* Fio do acento no topo: identifica o plano antes de o olho ler o nome. */}
      <span
        aria-hidden
        style={{ background: `linear-gradient(90deg, ${tone}, transparent)` }}
        className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold leading-snug text-admin-foreground">
              {plan.name}
            </h3>
            {plan.badge && <BadgePill text={plan.badge} accent={plan.accent} />}
          </div>
          {plan.headline && (
            <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-admin-foreground/55">
              {plan.headline}
            </p>
          )}
        </div>

        <ActionMenu
          items={actions}
          label={`Ações de ${plan.name}`}
          disabled={busy}
          onOpenChange={setMenuOpen}
        />
      </div>

      <div className="relative mt-4">
        <PriceTag plan={plan} />
      </div>

      <div className="relative mt-3 flex flex-wrap items-center gap-1.5">
        <SyncPill plan={plan} />
        <VisibilityPill plan={plan} />
        <IntervalPill plan={plan} />
        {plan.level && (
          <span className="inline-flex items-center rounded-full bg-admin-muted px-2.5 py-1 text-[11px] font-medium text-admin-foreground/60">
            {plan.level}
          </span>
        )}
      </div>

      <FeatureList
        features={plan.features}
        accent={plan.accent}
        limit={4}
        className="relative mt-4"
      />

      <div className="relative mt-auto pt-4">
        <SeatMeter plan={plan} className="mb-3" />

        <div className="flex items-center justify-between gap-2 border-t border-admin-border pt-3">
          <span className="inline-flex items-center gap-1.5 text-[12px] text-admin-foreground/55">
            <CheckIcon className="h-3.5 w-3.5 text-admin-foreground/35" />
            {plan.activeSubscribers}{" "}
            {plan.activeSubscribers === 1 ? "assinante" : "assinantes"}
          </span>

          {plan.stripePaymentLinkUrl ? (
            <CopyLinkButton url={plan.stripePaymentLinkUrl} label="Link" />
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-admin-foreground/30">
              <CopyIcon className="h-3.5 w-3.5" />
              sem link
            </span>
          )}
        </div>
      </div>
    </motion.article>
  );
}
