"use client";

/**
 * Criar e editar plano no mesmo painel.
 *
 * São um componente só porque os campos são idênticos — o que muda é a
 * Server Action e os valores iniciais. Duplicar o formulário garantiria que
 * um campo novo entrasse em um e esquecesse o outro.
 *
 * O painel é dividido em três blocos, na ordem em que se pensa um plano:
 * **o que é** (nome, chamada, benefícios), **quanto custa** (preço,
 * periodicidade, matrícula, teste) e **como aparece** (acento, selo,
 * destaque, vitrine). O terceiro bloco mostra uma prévia ao vivo do cartão —
 * o admin decide o visual olhando o resultado, não imaginando.
 */

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  createPlanAction,
  updatePlanAction,
  type PlanSaveResult,
} from "@/actions/admin/student-plans";
import { SidePanel } from "@/components/ui/side-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { FieldError, FormBanner } from "@/components/ui/form-message";
import { CEFR_LEVELS } from "@/types/domain";
import {
  PLAN_ACCENTS,
  PLAN_INTERVALS,
  PLAN_TIERS,
  type PlanAccent,
  type PlanTier,
} from "@/schemas/student-plans";
import { cn } from "@/lib/utils";
import {
  ACCENT_LABEL,
  ACCENT_TONE,
  FREQUENCY_LABEL,
  INTERVAL_LABEL,
  INTERVAL_SUFFIX,
  TIER_LABEL,
  WEEKLY_FREQUENCIES,
  splitMoney,
  tierFeatures,
  type StudentPlan,
} from "./plans-utils";
import type { ActionResult } from "@/types/action-result";
import { LogoLoader } from "@/components/ui/logo-loader";

const FIELD =
  "border-admin-border bg-admin-background focus-visible:ring-gold-500 text-admin-foreground";

/** `24900` → `249,00`, para o campo abrir com o valor já formatado. */
function centsToInput(cents: number): string {
  if (!cents) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

interface PlanFormPanelProps {
  open: boolean;
  onClose: () => void;
  /** Ausente = criação. */
  plan?: StudentPlan | null;
  /** `false` quando a conta Stripe ainda não pode cobrar — muda só o aviso. */
  canPublish: boolean;
}

export function PlanFormPanel({ open, onClose, plan, canPublish }: PlanFormPanelProps) {
  const router = useRouter();
  const isEdit = Boolean(plan);

  const action = useMemo(
    () =>
      plan
        ? (prev: ActionResult<PlanSaveResult> | null, formData: FormData) =>
            updatePlanAction(plan.id, prev, formData)
        : createPlanAction,
    [plan],
  );

  const [state, formAction, isPending] = useActionState(action, null);

  // Espelho local do que o admin está digitando, só para a prévia. O envio
  // continua sendo o FormData nativo — nada aqui é fonte da verdade.
  const [name, setName] = useState(plan?.name ?? "");
  const [headline, setHeadline] = useState(plan?.headline ?? "");
  const [price, setPrice] = useState(centsToInput(plan?.priceCents ?? 0));
  const [interval, setInterval] = useState(plan?.billingInterval ?? "month");
  const [accent, setAccent] = useState<PlanAccent>(plan?.accent ?? "gold");
  const [badge, setBadge] = useState(plan?.badge ?? "");
  const [tier, setTier] = useState<PlanTier | "">(plan?.tier ?? "");
  const [weeklyFrequency, setWeeklyFrequency] = useState(
    plan?.weeklyFrequency ? String(plan.weeklyFrequency) : "",
  );
  const featuresRef = useRef<HTMLTextAreaElement>(null);

  // Reabrir o painel noutro plano tem de recarregar a prévia — sem isto ela
  // continuaria mostrando o plano anterior.
  useEffect(() => {
    setName(plan?.name ?? "");
    setHeadline(plan?.headline ?? "");
    setPrice(centsToInput(plan?.priceCents ?? 0));
    setInterval(plan?.billingInterval ?? "month");
    setAccent(plan?.accent ?? "gold");
    setBadge(plan?.badge ?? "");
    setTier(plan?.tier ?? "");
    setWeeklyFrequency(plan?.weeklyFrequency ? String(plan.weeklyFrequency) : "");
  }, [plan, open]);

  /** Preenche benefícios com o padrão do PDF comercial para o nível escolhido. */
  function applyTierDefaults(nextTier: PlanTier | "") {
    setTier(nextTier);
    if (nextTier && featuresRef.current) {
      featuresRef.current.value = tierFeatures(nextTier).join("\n");
    }
  }

  // O sucesso pode ser parcial: salvo no banco, recusado pela Stripe. Nesse
  // caso o painel *não* fecha — o admin precisa ver por quê.
  useEffect(() => {
    if (!state?.success) return;
    router.refresh();
    if (state.data.synced) onClose();
  }, [state, router, onClose]);

  const fields = state && !state.success ? state.error.fields : undefined;
  const partial = state?.success && !state.data.synced ? state.data.syncMessage : null;

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar plano" : "Novo plano"}
      subtitle={
        isEdit
          ? "Alterações de preço criam um novo valor na Stripe — quem já assina continua no antigo."
          : "Ao salvar, o plano é publicado na Stripe e ganha um link de pagamento."
      }
      wide
    >
      <form action={formAction} className="flex min-h-full flex-col" noValidate>
        <div className="flex-1 space-y-6 px-4 py-5 sm:px-6">
          {state && !state.success && !state.error.fields && (
            <FormBanner tone="error">{state.error.message}</FormBanner>
          )}

          {partial && <FormBanner tone="error">{partial}</FormBanner>}

          {!canPublish && !partial && (
            <div className="rounded-xl border border-gold-300 bg-gold-50 p-3.5 text-xs leading-relaxed text-admin-foreground/70">
              A conta Stripe ainda não está habilitada a receber pagamentos. O plano será
              salvo como <strong className="font-medium">rascunho</strong> e publicado
              assim que o onboarding for concluído.
            </div>
          )}

          {/* ---------------------------------------------------------------
              O que é
          --------------------------------------------------------------- */}
          <Section title="O que é o plano">
            <div className="space-y-1.5">
              <Label htmlFor="plan-name" className="text-admin-foreground">
                Nome <span className="text-gold-600">*</span>
              </Label>
              <Input
                id="plan-name"
                name="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex.: Conversação Premium"
                autoComplete="off"
                required
                className={FIELD}
              />
              <FieldError messages={fields?.["name"]} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="plan-headline" className="text-admin-foreground">
                Chamada
              </Label>
              <Input
                id="plan-headline"
                name="headline"
                value={headline}
                onChange={(event) => setHeadline(event.target.value)}
                placeholder="Ex.: Para quem precisa destravar a fala"
                autoComplete="off"
                className={FIELD}
              />
              <p className="text-[11px] text-admin-foreground/45">
                Uma linha, logo abaixo do nome no cartão.
              </p>
              <FieldError messages={fields?.["headline"]} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="plan-features" className="text-admin-foreground">
                Benefícios
              </Label>
              <textarea
                ref={featuresRef}
                id="plan-features"
                name="features"
                rows={5}
                defaultValue={plan?.features.join("\n") ?? ""}
                placeholder={"4 aulas por mês\nMaterial digital incluso\nCorreção de redação"}
                className={cn(
                  "w-full rounded-md border px-3 py-2 text-sm leading-relaxed outline-none",
                  "focus-visible:ring-2",
                  FIELD,
                )}
              />
              <p className="text-[11px] text-admin-foreground/45">
                Um por linha, até 12. É a lista com o &quot;✓&quot; que o aluno vê.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="plan-description" className="text-admin-foreground">
                Descrição
              </Label>
              <textarea
                id="plan-description"
                name="description"
                rows={3}
                defaultValue={plan?.description ?? ""}
                placeholder="Texto mais longo, exibido no detalhe do plano."
                className={cn(
                  "w-full rounded-md border px-3 py-2 text-sm leading-relaxed outline-none",
                  "focus-visible:ring-2",
                  FIELD,
                )}
              />
              <FieldError messages={fields?.["description"]} />
            </div>
          </Section>

          {/* ---------------------------------------------------------------
              Grade de níveis
          --------------------------------------------------------------- */}
          <Section title="Grade de níveis (opcional)">
            <p className="-mt-2 text-[11px] leading-relaxed text-admin-foreground/45">
              Marcando nível e ritmo, este plano entra no construtor &ldquo;nível → ritmo →
              compromisso&rdquo; da vitrine. Deixe em branco para um plano avulso, fora da grade.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="plan-tier" className="text-admin-foreground">
                  Nível
                </Label>
                <Select
                  id="plan-tier"
                  name="tier"
                  tone="admin"
                  value={tier}
                  onChange={(next) => applyTierDefaults(next as PlanTier | "")}
                  placeholder="Plano avulso"
                >
                  <option value="">Plano avulso (fora da grade)</option>
                  {PLAN_TIERS.map((item) => (
                    <option key={item} value={item}>
                      {TIER_LABEL[item]}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="plan-weekly-frequency" className="text-admin-foreground">
                  Ritmo semanal
                </Label>
                <Select
                  id="plan-weekly-frequency"
                  name="weeklyFrequency"
                  tone="admin"
                  value={weeklyFrequency}
                  onChange={(next) => setWeeklyFrequency(next)}
                  placeholder="Sem ritmo fixo"
                >
                  <option value="">Sem ritmo fixo</option>
                  {WEEKLY_FREQUENCIES.map((item) => (
                    <option key={item} value={item}>
                      {FREQUENCY_LABEL[item]}
                    </option>
                  ))}
                </Select>
                <FieldError messages={fields?.["weeklyFrequency"]} />
              </div>
            </div>
          </Section>

          {/* ---------------------------------------------------------------
              Quanto custa
          --------------------------------------------------------------- */}
          <Section title="Cobrança">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="plan-price" className="text-admin-foreground">
                  Preço <span className="text-gold-600">*</span>
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-admin-foreground/40">
                    R$
                  </span>
                  <Input
                    id="plan-price"
                    name="price"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    inputMode="decimal"
                    placeholder="249,00"
                    autoComplete="off"
                    required
                    className={cn(FIELD, "pl-9 tabular")}
                  />
                </div>
                <FieldError messages={fields?.["priceCents"]} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="plan-interval" className="text-admin-foreground">
                  Periodicidade <span className="text-gold-600">*</span>
                </Label>
                <Select
                  id="plan-interval"
                  name="billingInterval"
                  tone="admin"
                  value={interval}
                  onChange={(next) => setInterval(next as typeof interval)}
                >
                  {PLAN_INTERVALS.map((item) => (
                    <option key={item} value={item}>
                      {INTERVAL_LABEL[item]}
                    </option>
                  ))}
                </Select>
                <FieldError messages={fields?.["billingInterval"]} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="plan-setup" className="text-admin-foreground">
                  Matrícula (uma vez)
                </Label>
                <Input
                  id="plan-setup"
                  name="setupFee"
                  defaultValue={centsToInput(plan?.setupFeeCents ?? 0)}
                  inputMode="decimal"
                  placeholder="0,00"
                  autoComplete="off"
                  className={cn(FIELD, "tabular")}
                />
                <FieldError messages={fields?.["setupFeeCents"]} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="plan-trial" className="text-admin-foreground">
                  Período de teste (dias)
                </Label>
                <Input
                  id="plan-trial"
                  name="trialDays"
                  defaultValue={plan?.trialDays ? String(plan.trialDays) : ""}
                  inputMode="numeric"
                  placeholder="0"
                  autoComplete="off"
                  className={cn(FIELD, "tabular")}
                />
                <FieldError messages={fields?.["trialDays"]} />
              </div>
            </div>
          </Section>

          {/* ---------------------------------------------------------------
              O que o aluno recebe
          --------------------------------------------------------------- */}
          <Section title="Conteúdo do pacote">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="plan-lessons" className="text-admin-foreground">
                  Aulas por mês
                </Label>
                <Input
                  id="plan-lessons"
                  name="lessonsPerMonth"
                  defaultValue={plan?.lessonsPerMonth ? String(plan.lessonsPerMonth) : ""}
                  inputMode="numeric"
                  placeholder="4"
                  autoComplete="off"
                  className={cn(FIELD, "tabular")}
                />
                <FieldError messages={fields?.["lessonsPerMonth"]} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="plan-minutes" className="text-admin-foreground">
                  Minutos por aula
                </Label>
                <Input
                  id="plan-minutes"
                  name="minutesPerLesson"
                  defaultValue={plan?.minutesPerLesson ? String(plan.minutesPerLesson) : ""}
                  inputMode="numeric"
                  placeholder="50"
                  autoComplete="off"
                  className={cn(FIELD, "tabular")}
                />
                <FieldError messages={fields?.["minutesPerLesson"]} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="plan-level" className="text-admin-foreground">
                  Nível sugerido
                </Label>
                <Select
                  id="plan-level"
                  name="level"
                  tone="admin"
                  defaultValue={plan?.level ?? ""}
                  placeholder="Qualquer nível"
                >
                  <option value="">Qualquer nível</option>
                  {CEFR_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="plan-seats" className="text-admin-foreground">
                  Limite de vagas
                </Label>
                <Input
                  id="plan-seats"
                  name="seatLimit"
                  defaultValue={plan?.seatLimit ? String(plan.seatLimit) : ""}
                  inputMode="numeric"
                  placeholder="ilimitado"
                  autoComplete="off"
                  className={cn(FIELD, "tabular")}
                />
                <FieldError messages={fields?.["seatLimit"]} />
              </div>
            </div>
          </Section>

          {/* ---------------------------------------------------------------
              Como aparece
          --------------------------------------------------------------- */}
          <Section title="Aparência na vitrine">
            <div className="space-y-2">
              <Label className="text-admin-foreground">Cor de acento</Label>
              <input type="hidden" name="accent" value={accent} />
              <div className="flex flex-wrap gap-2">
                {PLAN_ACCENTS.map((item) => {
                  const active = accent === item;
                  const tone = ACCENT_TONE[item];
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setAccent(item)}
                      aria-pressed={active}
                      style={
                        active
                          ? {
                              color: tone,
                              backgroundColor: `color-mix(in srgb, ${tone} 10%, #ffffff)`,
                              boxShadow: `inset 0 0 0 1.5px ${tone}`,
                            }
                          : undefined
                      }
                      className={cn(
                        "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
                        !active &&
                          "border border-admin-border bg-admin-surface text-admin-foreground/55 hover:border-gold-300 hover:text-admin-foreground",
                      )}
                    >
                      <span
                        aria-hidden
                        style={{ backgroundColor: tone }}
                        className="h-3 w-3 rounded-full"
                      />
                      {ACCENT_LABEL[item]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="plan-badge" className="text-admin-foreground">
                  Selo
                </Label>
                <Input
                  id="plan-badge"
                  name="badge"
                  value={badge}
                  onChange={(event) => setBadge(event.target.value)}
                  placeholder="Ex.: Mais vendido"
                  maxLength={24}
                  autoComplete="off"
                  className={FIELD}
                />
                <FieldError messages={fields?.["badge"]} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="plan-order" className="text-admin-foreground">
                  Posição na vitrine
                </Label>
                <Input
                  id="plan-order"
                  name="sortOrder"
                  defaultValue={String(plan?.sortOrder ?? 0)}
                  inputMode="numeric"
                  className={cn(FIELD, "tabular")}
                />
                <p className="text-[11px] text-admin-foreground/45">
                  Menor número aparece primeiro.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Toggle
                name="isPublic"
                label="Exibir na vitrine do aluno"
                hint="Desligado, o plano só é vendido pelo link que você enviar."
                defaultChecked={plan?.isPublic ?? true}
              />
              <Toggle
                name="isFeatured"
                label="Destacar como plano recomendado"
                hint="Ganha borda no acento e sobe um degrau na grade."
                defaultChecked={plan?.isFeatured ?? false}
              />
            </div>

            <PlanPreview
              name={name}
              headline={headline}
              price={price}
              interval={interval}
              accent={accent}
              badge={badge}
            />
          </Section>
        </div>

        <div className="sticky bottom-0 flex shrink-0 items-center justify-end gap-2 border-t border-admin-border bg-admin-surface px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-admin-foreground/60 transition-colors hover:bg-admin-muted hover:text-admin-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-opacity",
              "bg-gradient-to-r from-navy-800 to-navy-600 text-white",
              "hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {isPending && <LogoLoader size={16} label={null} />}
            {isPending
              ? "Publicando na Stripe..."
              : isEdit
                ? "Salvar alterações"
                : "Criar e publicar"}
          </button>
        </div>
      </form>
    </SidePanel>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="text-[10px] font-medium uppercase tracking-wide text-admin-foreground/50">
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * Interruptor. Um `<input type="checkbox">` de verdade por baixo — o
 * FormData precisa dele, e leitor de tela e teclado ganham o comportamento
 * nativo de graça.
 */
function Toggle({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint: string;
  defaultChecked: boolean;
}) {
  const [on, setOn] = useState(defaultChecked);
  const reduceMotion = useReducedMotion();

  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-admin-border bg-admin-background p-3 transition-colors hover:border-gold-300">
      <input
        type="checkbox"
        name={name}
        checked={on}
        onChange={(event) => setOn(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-gold-500",
          on ? "bg-gold-500" : "bg-admin-border",
        )}
      >
        <motion.span
          layout
          transition={
            reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 620, damping: 34 }
          }
          className={cn("h-4 w-4 rounded-full bg-white shadow-sm", on && "ml-auto")}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-admin-foreground">{label}</span>
        <span className="mt-0.5 block text-[11px] leading-snug text-admin-foreground/50">
          {hint}
        </span>
      </span>
    </label>
  );
}

/**
 * Prévia ao vivo do cartão. Não é um `PlanCard` de verdade — este só precisa
 * das quatro coisas que o admin está mexendo agora, e reaproveitar o cartão
 * completo obrigaria a fabricar um `StudentPlan` inteiro a cada tecla.
 */
function PlanPreview({
  name,
  headline,
  price,
  interval,
  accent,
  badge,
}: {
  name: string;
  headline: string;
  price: string;
  interval: string;
  accent: PlanAccent;
  badge: string;
}) {
  const tone = ACCENT_TONE[accent];
  const cents = Math.round(Number(price.replace(/[^\d,.-]/g, "").replace(",", ".")) * 100);
  const { whole, fraction } = splitMoney(Number.isFinite(cents) && cents > 0 ? cents : 0);

  return (
    <div>
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-admin-foreground/50">
        Prévia
      </p>
      <motion.div
        layout
        style={{ boxShadow: `0 0 0 1.5px ${tone}` }}
        className="relative overflow-hidden rounded-2xl bg-admin-background p-4"
      >
        <span
          aria-hidden
          style={{ background: `linear-gradient(90deg, ${tone}, transparent)` }}
          className="absolute inset-x-0 top-0 h-[3px]"
        />

        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-admin-foreground">
            {name || "Nome do plano"}
          </p>
          <AnimatePresence>
            {badge && (
              <motion.span
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                style={{
                  color: tone,
                  backgroundColor: `color-mix(in srgb, ${tone} 12%, #ffffff)`,
                  boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone} 32%, transparent)`,
                }}
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              >
                {badge}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-0.5 truncate text-[12px] text-admin-foreground/50">
          {headline || "Chamada do plano"}
        </p>

        <p className="mt-3 flex items-baseline gap-1 leading-none text-admin-foreground">
          <span className="text-[12px] font-medium text-admin-foreground/45">R$</span>
          <span className="text-[26px] font-semibold tabular tracking-tight">{whole}</span>
          <span className="text-[13px] font-semibold tabular text-admin-foreground/55">
            ,{fraction}
          </span>
          <span className="text-[12px] font-medium text-admin-foreground/45">
            {INTERVAL_SUFFIX[interval as keyof typeof INTERVAL_SUFFIX] ?? ""}
          </span>
        </p>
      </motion.div>
    </div>
  );
}
