"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit";
import {
  createFinanceEntry,
  deleteFinanceEntry,
  getFinanceEntry,
  setFinanceEntryStatus,
  updateFinanceEntry,
  type FinanceEntryWrite,
} from "@/repositories/finance";
import {
  financeEntrySchema,
  financeFieldsFromFormData,
  kindOfCategory,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/schemas/finance";
import { fail, ok, type ActionResult } from "@/types/action-result";

/**
 * Ações do Financeiro.
 *
 * Duas rotas revalidadas em toda escrita: a tela de lançamentos e o painel
 * inicial. O DRE do dashboard lê a mesma tabela — deixar só `/admin/financeiro`
 * faria o admin lançar uma despesa e voltar para um resultado desatualizado.
 */

const PAGE = "/admin/financeiro";
const DASHBOARD = "/admin";

function revalidateFinance() {
  revalidatePath(PAGE);
  revalidatePath(DASHBOARD);
}

/** Formulário validado → o que o repositório grava. */
function toWrite(parsed: ReturnType<typeof financeEntrySchema.parse>): FinanceEntryWrite {
  return {
    kind: kindOfCategory(parsed.category, parsed.direction),
    category: parsed.category,
    description: parsed.description,
    counterparty: parsed.counterparty,
    amountCents: parsed.amountCents,
    occurredOn: parsed.occurredOn,
    dueOn: parsed.dueOn,
    status: parsed.status,
    paidOn: parsed.paidOn,
    paymentMethod: parsed.paymentMethod,
    notes: parsed.notes,
  };
}

export async function createFinanceEntryAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireRole(["admin"]);

  const parsed = financeEntrySchema.safeParse(financeFieldsFromFormData(formData));
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos destacados.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const write = toWrite(parsed.data);
  const id = await createFinanceEntry(ctx.organizationId, ctx.userId, write);
  if (!id) return fail("INTERNAL_ERROR", "Não foi possível salvar o lançamento.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "FINANCE_ENTRY_CREATE",
    entityType: "finance_entry",
    entityId: id,
    metadata: {
      kind: write.kind,
      category: write.category,
      amount_cents: write.amountCents,
      status: write.status,
    },
  });

  revalidateFinance();
  return ok({ id });
}

export async function updateFinanceEntryAction(
  entryId: string,
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireRole(["admin"]);

  const parsed = financeEntrySchema.safeParse(financeFieldsFromFormData(formData));
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Verifique os campos destacados.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const existing = await getFinanceEntry(ctx.organizationId, entryId);
  if (!existing) return fail("NOT_FOUND", "Lançamento não encontrado.");

  const write = toWrite(parsed.data);
  const updated = await updateFinanceEntry(ctx.organizationId, entryId, write);
  if (!updated) return fail("INTERNAL_ERROR", "Não foi possível salvar as alterações.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "FINANCE_ENTRY_UPDATE",
    entityType: "finance_entry",
    entityId: entryId,
    metadata: {
      amount_cents_before: existing.amountCents,
      amount_cents_after: write.amountCents,
      status_after: write.status,
    },
  });

  revalidateFinance();
  return ok({ id: entryId });
}

/**
 * Baixa do lançamento direto da lista. `paidOn` vazio significa "hoje" — é o
 * caso comum de quem acabou de ver o PIX cair.
 */
export async function settleFinanceEntryAction(
  entryId: string,
  input: { paidOn?: string; paymentMethod?: string } = {},
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);

  const entry = await getFinanceEntry(ctx.organizationId, entryId);
  if (!entry) return fail("NOT_FOUND", "Lançamento não encontrado.");

  const method =
    input.paymentMethod &&
    (PAYMENT_METHODS as readonly string[]).includes(input.paymentMethod)
      ? (input.paymentMethod as PaymentMethod)
      : undefined;

  const done = await setFinanceEntryStatus(ctx.organizationId, entryId, "paid", {
    ...(input.paidOn ? { paidOn: input.paidOn } : {}),
    ...(method ? { paymentMethod: method } : {}),
  });
  if (!done) return fail("INTERNAL_ERROR", "Não foi possível dar baixa no lançamento.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "FINANCE_ENTRY_SETTLE",
    entityType: "finance_entry",
    entityId: entryId,
    metadata: { amount_cents: entry.amountCents, direction: entry.direction },
  });

  revalidateFinance();
  return ok(undefined as never);
}

/** Estorno da baixa: o lançamento volta a ser uma previsão em aberto. */
export async function reopenFinanceEntryAction(
  entryId: string,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);

  const entry = await getFinanceEntry(ctx.organizationId, entryId);
  if (!entry) return fail("NOT_FOUND", "Lançamento não encontrado.");

  const done = await setFinanceEntryStatus(ctx.organizationId, entryId, "pending");
  if (!done) return fail("INTERNAL_ERROR", "Não foi possível reabrir o lançamento.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "FINANCE_ENTRY_REOPEN",
    entityType: "finance_entry",
    entityId: entryId,
  });

  revalidateFinance();
  return ok(undefined as never);
}

/**
 * Troca só a forma de pagamento, pelo seletor da própria linha. Fica separada
 * da baixa porque o admin costuma acertar o meio *antes* de o dinheiro cair —
 * e obrigar isso a passar pelo formulário inteiro seria atrito puro.
 */
export async function setFinancePaymentMethodAction(
  entryId: string,
  method: string,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);

  const valid = method === "" || (PAYMENT_METHODS as readonly string[]).includes(method);
  if (!valid) return fail("VALIDATION_ERROR", "Forma de pagamento inválida.");

  const entry = await getFinanceEntry(ctx.organizationId, entryId);
  if (!entry) return fail("NOT_FOUND", "Lançamento não encontrado.");

  const done = await updateFinanceEntry(ctx.organizationId, entryId, {
    kind: entry.kind,
    category: entry.category,
    description: entry.description,
    counterparty: entry.counterparty ?? undefined,
    amountCents: entry.amountCents,
    occurredOn: entry.occurredOn,
    dueOn: entry.dueOn,
    status: entry.status,
    paidOn: entry.paidOn ?? undefined,
    paymentMethod: method ? (method as PaymentMethod) : undefined,
    notes: entry.notes ?? undefined,
  });
  if (!done)
    return fail("INTERNAL_ERROR", "Não foi possível atualizar a forma de pagamento.");

  revalidateFinance();
  return ok(undefined as never);
}

/**
 * Exclusão definitiva. Não há arquivamento aqui de propósito: um lançamento
 * errado polui o resultado do mês enquanto existir, e o rastro de quem apagou
 * o quê fica na auditoria.
 */
export async function deleteFinanceEntryAction(
  entryId: string,
): Promise<ActionResult<never>> {
  const ctx = await requireRole(["admin"]);

  const entry = await getFinanceEntry(ctx.organizationId, entryId);
  if (!entry) return fail("NOT_FOUND", "Lançamento não encontrado.");

  const done = await deleteFinanceEntry(ctx.organizationId, entryId);
  if (!done) return fail("INTERNAL_ERROR", "Não foi possível excluir o lançamento.");

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "FINANCE_ENTRY_DELETE",
    entityType: "finance_entry",
    entityId: entryId,
    metadata: {
      description: entry.description,
      amount_cents: entry.amountCents,
      kind: entry.kind,
      occurred_on: entry.occurredOn,
    },
  });

  revalidateFinance();
  return ok(undefined as never);
}
