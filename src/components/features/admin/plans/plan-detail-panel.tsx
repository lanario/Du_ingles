"use client";

/**
 * Detalhe de um plano. Além dos dados, é aqui que vivem as duas ações que o
 * admin mais executa: **copiar o link de pagamento** para mandar ao aluno e
 * **reprocessar** um plano que a Stripe recusou.
 *
 * Quando a sincronização falhou, o erro cru da Stripe aparece inteiro — é
 * curto, é específico ("No such price"), e escondê-lo atrás de "erro ao
 * salvar" só faria o admin abrir um chamado.
 */

import { AnimatePresence, motion } from "framer-motion";
import { SidePanel } from "@/components/ui/side-panel";
import {
  DetailActions,
  DetailBody,
  DetailButton,
  DetailRow,
  DetailSection,
} from "@/components/ui/detail-panel";
import {
  CalendarIcon,
  ClockIcon,
  CopyIcon,
  GraduationIcon,
  GroupsIcon,
  PencilIcon,
  PowerIcon,
  SwapIcon,
  UserIcon,
} from "@/components/ui/icons";
import {
  BadgePill,
  CopyLinkButton,
  FeatureList,
  IntervalPill,
  PriceTag,
  SeatMeter,
  SyncPill,
  VisibilityPill,
} from "./plans-visuals";
import {
  ACCENT_TONE,
  INTERVAL_LABEL,
  formatDate,
  formatMoney,
  type StudentPlan,
} from "./plans-utils";

interface PlanDetailPanelProps {
  plan: StudentPlan | null;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onEdit: () => void;
  onSync: () => void;
  onToggleActive: () => void;
}

export function PlanDetailPanel({
  plan,
  open,
  busy,
  onClose,
  onEdit,
  onSync,
  onToggleActive,
}: PlanDetailPanelProps) {
  if (!plan) return null;
  const tone = ACCENT_TONE[plan.accent];

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={plan.name}
      subtitle={plan.headline ?? INTERVAL_LABEL[plan.billingInterval]}
    >
      <DetailBody>
        <div
          className="relative overflow-hidden rounded-2xl p-4"
          style={{
            background: `linear-gradient(140deg, color-mix(in srgb, ${tone} 12%, #ffffff) 0%, var(--admin-background) 70%)`,
            boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone} 26%, transparent)`,
          }}
        >
          <PriceTag plan={plan} size="lg" />

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <SyncPill plan={plan} />
            <VisibilityPill plan={plan} />
            <IntervalPill plan={plan} />
            {plan.badge && <BadgePill text={plan.badge} accent={plan.accent} />}
          </div>
        </div>

        <AnimatePresence>
          {plan.syncStatus === "error" && plan.syncError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              role="alert"
              className="overflow-hidden rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5"
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-destructive/80">
                A Stripe recusou
              </p>
              <p className="mt-1 text-[13px] leading-snug text-destructive">
                {plan.syncError}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <DetailActions>
          <DetailButton icon={PencilIcon} label="Editar" tone="accent" onClick={onEdit} />
          <DetailButton
            icon={SwapIcon}
            label={plan.syncStatus === "synced" ? "Ressincronizar" : "Publicar"}
            onClick={onSync}
            disabled={busy}
          />
          <DetailButton
            icon={PowerIcon}
            label={plan.isActive ? "Arquivar" : "Reativar"}
            tone={plan.isActive ? "danger" : "default"}
            onClick={onToggleActive}
            disabled={busy}
          />
        </DetailActions>

        {plan.description && (
          <DetailSection title="Descrição">
            <p className="whitespace-pre-line text-[13px] leading-relaxed text-admin-foreground/70">
              {plan.description}
            </p>
          </DetailSection>
        )}

        {plan.features.length > 0 && (
          <DetailSection title="Benefícios">
            <FeatureList features={plan.features} accent={plan.accent} />
          </DetailSection>
        )}

        <DetailSection title="Link de pagamento">
          {plan.stripePaymentLinkUrl ? (
            <div className="rounded-xl border border-admin-border bg-admin-background p-3">
              <p className="break-all font-mono text-[11px] leading-relaxed text-admin-foreground/70">
                {plan.stripePaymentLinkUrl}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1">
                <CopyLinkButton url={plan.stripePaymentLinkUrl} />
                <a
                  href={plan.stripePaymentLinkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium text-admin-foreground/55 transition-colors hover:bg-admin-muted hover:text-admin-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
                >
                  <CopyIcon className="h-3.5 w-3.5" />
                  Abrir checkout
                </a>
              </div>
              <p className="mt-2 text-[11px] leading-snug text-admin-foreground/45">
                Quem abrir o link precisa informar o mesmo e-mail cadastrado na
                plataforma — é por ele que a assinatura é vinculada ao aluno.
              </p>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-admin-border px-3 py-4 text-center text-[13px] text-admin-foreground/45">
              O link é gerado quando o plano é publicado na Stripe.
            </p>
          )}
        </DetailSection>

        <DetailSection title="Assinantes">
          <div className="rounded-xl border border-admin-border bg-admin-background p-3">
            <p className="text-2xl font-semibold tabular text-admin-foreground">
              {plan.activeSubscribers}
            </p>
            <p className="text-[12px] text-admin-foreground/50">
              {plan.seatLimit === null
                ? "vagas ilimitadas"
                : `de ${plan.seatLimit} vagas`}
            </p>
            <SeatMeter plan={plan} className="mt-3" />
          </div>
        </DetailSection>

        <DetailSection title="Ficha técnica">
          <DetailRow
            icon={ClockIcon}
            label="Periodicidade"
            value={INTERVAL_LABEL[plan.billingInterval]}
          />
          <DetailRow
            icon={GroupsIcon}
            label="Matrícula"
            value={
              plan.setupFeeCents > 0
                ? formatMoney(plan.setupFeeCents, plan.currency)
                : "sem taxa"
            }
          />
          <DetailRow
            icon={CalendarIcon}
            label="Período de teste"
            value={plan.trialDays > 0 ? `${plan.trialDays} dias` : "sem teste"}
          />
          <DetailRow
            icon={UserIcon}
            label="Aulas por mês"
            value={
              plan.lessonsPerMonth
                ? `${plan.lessonsPerMonth}${plan.minutesPerLesson ? ` × ${plan.minutesPerLesson} min` : ""}`
                : null
            }
          />
          <DetailRow icon={GraduationIcon} label="Nível sugerido" value={plan.level} />
        </DetailSection>

        <DetailSection title="Stripe">
          <DetailRow
            icon={SwapIcon}
            label="Produto"
            value={plan.stripeProductId}
            mono
            action={
              plan.stripeProductId ? <CopyLinkButton url={plan.stripeProductId} label="" /> : null
            }
          />
          <DetailRow
            icon={SwapIcon}
            label="Preço"
            value={plan.stripePriceId}
            mono
            action={
              plan.stripePriceId ? <CopyLinkButton url={plan.stripePriceId} label="" /> : null
            }
          />
          <DetailRow
            icon={CalendarIcon}
            label="Sincronizado em"
            value={formatDate(plan.syncedAt)}
          />
        </DetailSection>
      </DetailBody>
    </SidePanel>
  );
}
