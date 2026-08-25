"use client";

/**
 * Criar e editar lançamento no mesmo painel — os campos são idênticos; o que
 * muda é a Server Action e os valores iniciais.
 *
 * A ordem dos blocos é a da conversa real de quem lança: **o que é** (entra ou
 * sai, categoria, descrição), **quanto e quando** (valor, competência,
 * vencimento) e **já foi liquidado?** (baixa e forma de pagamento). O último
 * bloco só se abre quando a resposta é sim, porque na maioria dos lançamentos
 * ela é não.
 *
 * A prévia no rodapé mostra a linha exatamente como ela vai aparecer na lista:
 * o admin confere o resultado, não imagina.
 */

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  createFinanceEntryAction,
  updateFinanceEntryAction,
} from "@/actions/admin/finance";
import { SidePanel } from "@/components/ui/side-panel";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { FieldError, FormBanner } from "@/components/ui/form-message";
import { ArrowInIcon, ArrowOutIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import {
  categoriesFor,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  type FinanceDirection,
} from "@/schemas/finance";
import {
  DIRECTION_COPY,
  DIRECTION_TONE,
  formatMoney,
  type FinanceEntry,
} from "./finance-utils";
import type { ActionResult } from "@/types/action-result";
import { LogoLoader } from "@/components/ui/logo-loader";

const FIELD =
  "border-admin-border bg-admin-background focus-visible:ring-gold-500 text-admin-foreground";

/** `24900` → `249,00`, para o campo abrir com o valor já formatado. */
function centsToInput(cents: number): string {
  if (!cents) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** Lê o que está digitado no campo de valor só para a prévia. */
function inputToCents(raw: string): number {
  const digits = raw.replace(/[^\d,.-]/g, "");
  if (!digits) return 0;
  const decimalAt = Math.max(digits.lastIndexOf(","), digits.lastIndexOf("."));
  const normalized =
    decimalAt === -1
      ? digits.replace(/[.,]/g, "")
      : `${digits.slice(0, decimalAt).replace(/[.,]/g, "")}.${digits.slice(decimalAt + 1)}`;
  const value = Number(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

interface EntryFormPanelProps {
  open: boolean;
  onClose: () => void;
  /** Ausente = criação. */
  entry?: FinanceEntry | null;
  /** Direção sugerida ao criar: a aba em que o admin estava. */
  initialDirection: FinanceDirection;
  /** Data sugerida (hoje, ou dia 1 quando se navega por outro mês). */
  suggestedDate: string;
}

export function EntryFormPanel({
  open,
  onClose,
  entry,
  initialDirection,
  suggestedDate,
}: EntryFormPanelProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const isEdit = Boolean(entry);

  const action = useMemo(
    () =>
      entry
        ? (prev: ActionResult<{ id: string }> | null, formData: FormData) =>
            updateFinanceEntryAction(entry.id, prev, formData)
        : createFinanceEntryAction,
    [entry],
  );

  const [state, formAction, isPending] = useActionState(action, null);

  const [direction, setDirection] = useState<FinanceDirection>(
    entry?.direction ?? initialDirection,
  );
  const [category, setCategory] = useState(entry?.category ?? "");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [amount, setAmount] = useState(centsToInput(entry?.amountCents ?? 0));
  const [occurredOn, setOccurredOn] = useState(entry?.occurredOn ?? suggestedDate);
  const [dueOn, setDueOn] = useState(entry?.dueOn ?? suggestedDate);
  const [settled, setSettled] = useState(entry?.status === "paid");
  const [paidOn, setPaidOn] = useState(entry?.paidOn ?? suggestedDate);
  const [paymentMethod, setPaymentMethod] = useState(entry?.paymentMethod ?? "");

  // Reabrir o painel em outro lançamento (ou em "novo") tem de recarregar os
  // campos — sem isto o formulário continuaria com o registro anterior.
  useEffect(() => {
    if (!open) return;
    setDirection(entry?.direction ?? initialDirection);
    setCategory(entry?.category ?? "");
    setDescription(entry?.description ?? "");
    setAmount(centsToInput(entry?.amountCents ?? 0));
    setOccurredOn(entry?.occurredOn ?? suggestedDate);
    setDueOn(entry?.dueOn ?? suggestedDate);
    setSettled(entry?.status === "paid");
    setPaidOn(entry?.paidOn ?? suggestedDate);
    setPaymentMethod(entry?.paymentMethod ?? "");
  }, [entry, open, initialDirection, suggestedDate]);

  useEffect(() => {
    if (!state?.success) return;
    router.refresh();
    onClose();
  }, [state, router, onClose]);

  const categories = categoriesFor(direction);

  // Trocar de tipo invalida a categoria escolhida: "aluguel" não é receita.
  useEffect(() => {
    if (category && categories.some((item) => item.id === category)) return;
    setCategory(categories[0]?.id ?? "");
  }, [direction, category, categories]);

  const fields = state && !state.success ? state.error.fields : undefined;
  const tone = DIRECTION_TONE[direction];
  const copy = DIRECTION_COPY[direction];
  const previewCents = inputToCents(amount);

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar lançamento" : copy.create}
      subtitle={
        isEdit
          ? "A competência define em qual mês o valor pesa no resultado — o vencimento não muda isso."
          : "Lance o combinado agora e dê baixa quando o dinheiro entrar. Só o que está liquidado conta como caixa."
      }
      wide
    >
      <form action={formAction} className="flex min-h-full flex-col" noValidate>
        <input type="hidden" name="direction" value={direction} />
        <input type="hidden" name="status" value={settled ? "paid" : "pending"} />

        <div className="flex-1 space-y-6 px-4 py-5 sm:px-6">
          {state && !state.success && !state.error.fields && (
            <FormBanner tone="error">{state.error.message}</FormBanner>
          )}

          {/* ---------------------------------------------------------------
              O que é
          --------------------------------------------------------------- */}
          <Section title="O que é o lançamento">
            <div
              role="group"
              aria-label="Tipo de lançamento"
              className="grid grid-cols-2 gap-2"
            >
              {(["in", "out"] as const).map((option) => {
                const active = direction === option;
                const Icon = option === "in" ? ArrowInIcon : ArrowOutIcon;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setDirection(option)}
                    aria-pressed={active}
                    className={cn(
                      "relative flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left transition-colors",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
                      active
                        ? "border-transparent"
                        : "border-admin-border hover:border-gold-300",
                    )}
                    style={
                      active
                        ? {
                            boxShadow: `inset 0 0 0 1.5px ${DIRECTION_TONE[option]}`,
                            backgroundColor: `color-mix(in srgb, ${DIRECTION_TONE[option]} 6%, #ffffff)`,
                          }
                        : undefined
                    }
                  >
                    <span
                      aria-hidden
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${DIRECTION_TONE[option]} 12%, #ffffff)`,
                        color: DIRECTION_TONE[option],
                      }}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-admin-foreground">
                        {option === "in" ? "Receita" : "Despesa"}
                      </span>
                      <span className="block text-[11px] text-admin-foreground/50">
                        {option === "in" ? "Entra dinheiro" : "Sai dinheiro"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="entry-category" className="text-admin-foreground">
                Categoria <span className="text-gold-600">*</span>
              </Label>
              <Select
                id="entry-category"
                name="category"
                tone="admin"
                value={category}
                onChange={setCategory}
                className="bg-admin-background"
              >
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </Select>
              <p className="text-[11px] text-admin-foreground/45">
                {categories.find((item) => item.id === category)?.hint ??
                  "Define a linha de negócio no resumo do mês."}
              </p>
              <FieldError messages={fields?.["category"]} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="entry-description" className="text-admin-foreground">
                Descrição <span className="text-gold-600">*</span>
              </Label>
              <Input
                id="entry-description"
                name="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={
                  direction === "in"
                    ? "Ex.: Mensalidade de agosto — Turma B1 noite"
                    : "Ex.: Cachê do professor Lucas — agosto"
                }
                autoComplete="off"
                required
                className={FIELD}
              />
              <FieldError messages={fields?.["description"]} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="entry-counterparty" className="text-admin-foreground">
                {direction === "in" ? "Aluno ou pagador" : "Fornecedor ou beneficiário"}
              </Label>
              <Input
                id="entry-counterparty"
                name="counterparty"
                defaultValue={entry?.counterparty ?? ""}
                placeholder={
                  direction === "in" ? "Ex.: Ana Prado" : "Ex.: Lucas Ferreira"
                }
                autoComplete="off"
                className={FIELD}
              />
              <FieldError messages={fields?.["counterparty"]} />
            </div>
          </Section>

          {/* ---------------------------------------------------------------
              Quanto e quando
          --------------------------------------------------------------- */}
          <Section title="Quanto e quando">
            <div className="space-y-1.5">
              <Label htmlFor="entry-amount" className="text-admin-foreground">
                Valor <span className="text-gold-600">*</span>
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-admin-foreground/40">
                  R$
                </span>
                <Input
                  id="entry-amount"
                  name="amount"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  inputMode="decimal"
                  placeholder="0,00"
                  autoComplete="off"
                  required
                  className={cn(FIELD, "pl-9 text-base font-semibold tabular")}
                />
              </div>
              <FieldError messages={fields?.["amountCents"]} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="entry-occurred" className="text-admin-foreground">
                  Competência <span className="text-gold-600">*</span>
                </Label>
                <DateField
                  id="entry-occurred"
                  name="occurredOn"
                  tone="admin"
                  value={occurredOn}
                  onChange={(value) => {
                    setOccurredOn(value);
                    // Vencimento acompanha a competência enquanto não for
                    // mexido na mão — é o caso da maioria dos lançamentos.
                    if (dueOn === occurredOn) setDueOn(value);
                  }}
                  required
                />
                <p className="text-[11px] text-admin-foreground/45">
                  O mês em que este valor entra no resultado.
                </p>
                <FieldError messages={fields?.["occurredOn"]} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="entry-due" className="text-admin-foreground">
                  Vencimento
                </Label>
                <DateField
                  id="entry-due"
                  name="dueOn"
                  tone="admin"
                  value={dueOn}
                  onChange={setDueOn}
                />
                <p className="text-[11px] text-admin-foreground/45">
                  Depois desta data, o lançamento em aberto aparece como vencido.
                </p>
                <FieldError messages={fields?.["dueOn"]} />
              </div>
            </div>
          </Section>

          {/* ---------------------------------------------------------------
              Liquidação
          --------------------------------------------------------------- */}
          <Section title={direction === "in" ? "Já recebeu?" : "Já pagou?"}>
            <button
              type="button"
              role="switch"
              aria-checked={settled}
              onClick={() => setSettled((value) => !value)}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
                settled
                  ? "border-transparent"
                  : "border-admin-border hover:border-gold-300",
              )}
              style={
                settled
                  ? {
                      boxShadow: "inset 0 0 0 1.5px var(--success)",
                      backgroundColor: "color-mix(in srgb, var(--success) 6%, #ffffff)",
                    }
                  : undefined
              }
            >
              <span>
                <span className="block text-sm font-medium text-admin-foreground">
                  {settled
                    ? direction === "in"
                      ? "Valor já recebido"
                      : "Valor já pago"
                    : "Ainda em aberto"}
                </span>
                <span className="block text-[11px] text-admin-foreground/50">
                  {settled
                    ? "Conta como caixa realizado do mês."
                    : `Fica em ${copy.open.toLowerCase()} até a baixa.`}
                </span>
              </span>
              <span
                aria-hidden
                className={cn(
                  "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                  settled ? "bg-success" : "bg-admin-muted",
                )}
              >
                <motion.span
                  layout
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 500, damping: 34 }
                  }
                  className={cn(
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow",
                    settled ? "left-[1.375rem]" : "left-0.5",
                  )}
                />
              </span>
            </button>

            <AnimatePresence initial={false}>
              {settled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="grid gap-4 pt-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="entry-paid" className="text-admin-foreground">
                        Data da baixa <span className="text-gold-600">*</span>
                      </Label>
                      <DateField
                        id="entry-paid"
                        name="paidOn"
                        tone="admin"
                        value={paidOn}
                        onChange={setPaidOn}
                      />
                      <FieldError messages={fields?.["paidOn"]} />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="entry-method" className="text-admin-foreground">
                        Forma de pagamento
                      </Label>
                      <Select
                        id="entry-method"
                        name="paymentMethod"
                        tone="admin"
                        value={paymentMethod}
                        onChange={setPaymentMethod}
                        className="bg-admin-background"
                      >
                        <option value="">Não informada</option>
                        {PAYMENT_METHODS.map((method) => (
                          <option key={method} value={method}>
                            {PAYMENT_METHOD_LABEL[method]}
                          </option>
                        ))}
                      </Select>
                      <FieldError messages={fields?.["paymentMethod"]} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!settled && (
              <input type="hidden" name="paymentMethod" value={paymentMethod} />
            )}

            <div className="space-y-1.5">
              <Label htmlFor="entry-notes" className="text-admin-foreground">
                Observações
              </Label>
              <textarea
                id="entry-notes"
                name="notes"
                rows={3}
                defaultValue={entry?.notes ?? ""}
                placeholder="Combinações, parcelamento, número da nota..."
                className={cn(
                  "w-full rounded-md border px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-2",
                  FIELD,
                )}
              />
              <FieldError messages={fields?.["notes"]} />
            </div>
          </Section>

          {/* Prévia da linha, como ela vai aparecer na lista. */}
          <div className="rounded-xl border border-dashed border-admin-border bg-admin-background p-3.5">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-admin-foreground/40">
              Prévia
            </p>
            <div className="mt-2 flex items-center gap-3">
              <span
                aria-hidden
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: `color-mix(in srgb, ${tone} 11%, #ffffff)`,
                  color: tone,
                }}
              >
                {direction === "in" ? (
                  <ArrowInIcon className="h-4 w-4" />
                ) : (
                  <ArrowOutIcon className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-admin-foreground">
                  {description || "Descrição do lançamento"}
                </p>
                <p className="text-[11px] text-admin-foreground/50">
                  {categories.find((item) => item.id === category)?.label ?? "Categoria"}{" "}
                  · {settled ? "liquidado" : "em aberto"}
                </p>
              </div>
              <span
                className="shrink-0 text-sm font-semibold tabular"
                style={{ color: tone }}
              >
                {direction === "in" ? "+" : "−"}
                {formatMoney(previewCents)}
              </span>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 flex shrink-0 items-center justify-end gap-3 border-t border-admin-border bg-admin-surface px-4 py-4 sm:px-6">
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
              "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity",
              "bg-gradient-to-r from-navy-800 to-navy-600 hover:opacity-90 disabled:opacity-60",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
            )}
          >
            {isPending && <LogoLoader size={16} label={null} />}
            {isEdit ? "Salvar alterações" : copy.create}
          </button>
        </div>
      </form>
    </SidePanel>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-admin-foreground/55">
          {title}
        </h3>
        <span className="h-px flex-1 bg-gradient-to-r from-gold-300 to-transparent" />
      </div>
      {children}
    </section>
  );
}
