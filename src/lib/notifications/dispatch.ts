import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { AppRole } from "@/types/domain";

/**
 * Escrita na caixa de notificações.
 *
 * Sempre por service-role: `notifications` só tem policy de select/update
 * para o próprio destinatário (§5.3) — ninguém, nem o professor, escreve na
 * caixa de outra pessoa pelo client comum. Mesmo desenho de `lib/audit.ts`.
 *
 * Nada aqui lança: uma notificação que falha não pode derrubar a escrita de
 * domínio que já aconteceu (a tarefa foi criada, a aula foi remarcada). O
 * erro vai para o log e a ação segue.
 */

export interface Recipient {
  id: string;
  /** Decide o link: as mesmas telas moram em prefixos diferentes por área. */
  role: AppRole;
  name: string;
}

export interface NotificationDraft {
  /** Rótulo livre — `visualFor` (view.ts) traduz em ícone, tom e chip. */
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
}

export interface DispatchInput {
  organizationId: string;
  recipients: readonly Recipient[];
  /** Quem agiu não é avisado do próprio ato. */
  exclude?: readonly (string | null | undefined)[];
  /** `null` pula o destinatário — usado quando o aviso não faz sentido para o papel. */
  build: (recipient: Recipient) => NotificationDraft | null;
  /**
   * Evita repetir o mesmo aviso. `unread` é o caso do chat (uma linha por
   * conversa enquanto a anterior não foi lida); `withinMinutes` cobre
   * reentrega de webhook e cliques repetidos no mesmo botão.
   */
  dedupe?: { unread?: boolean; withinMinutes?: number };
}

const MAX_TITLE = 160;
const MAX_BODY = 500;

/** Corta no limite de exibição sem partir a última palavra no meio. */
export function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Chave de deduplicação: mesma pessoa, mesmo assunto, mesmo destino. */
function keyOf(recipientId: string, type: string, link: string | null): string {
  return `${recipientId}|${type}|${link ?? ""}`;
}

async function alreadySent(
  rows: ReadonlyArray<{ recipientId: string; draft: NotificationDraft }>,
  dedupe: NonNullable<DispatchInput["dedupe"]>,
): Promise<Set<string>> {
  const admin = createAdminSupabaseClient();
  let query = admin
    .from("notifications")
    .select("recipient_id, type, link")
    .in("recipient_id", [...new Set(rows.map((row) => row.recipientId))])
    .in("type", [...new Set(rows.map((row) => row.draft.type))]);

  if (dedupe.withinMinutes !== undefined) {
    const cutoff = new Date(Date.now() - dedupe.withinMinutes * 60_000).toISOString();
    query = query.gte("created_at", cutoff);
  }
  if (dedupe.unread) query = query.is("read_at", null);

  const { data, error } = await query;
  if (error || !data) return new Set();
  return new Set(data.map((row) => keyOf(row.recipient_id, row.type, row.link)));
}

/**
 * Monta e grava as notificações de um evento. Devolve quantas foram criadas —
 * zero é um resultado válido (todo mundo era o próprio autor, ou já tinha o
 * aviso na caixa).
 */
export async function dispatchNotifications(input: DispatchInput): Promise<number> {
  try {
    const excluded = new Set(
      (input.exclude ?? []).filter((id): id is string => Boolean(id)),
    );

    const seen = new Set<string>();
    const rows: Array<{ recipientId: string; draft: NotificationDraft }> = [];

    for (const recipient of input.recipients) {
      if (!recipient?.id || excluded.has(recipient.id) || seen.has(recipient.id))
        continue;
      seen.add(recipient.id);

      const draft = input.build(recipient);
      if (!draft) continue;
      rows.push({ recipientId: recipient.id, draft });
    }

    if (rows.length === 0) return 0;

    const skip = input.dedupe ? await alreadySent(rows, input.dedupe) : new Set<string>();
    const pending = rows.filter(
      (row) => !skip.has(keyOf(row.recipientId, row.draft.type, row.draft.link ?? null)),
    );
    if (pending.length === 0) return 0;

    const admin = createAdminSupabaseClient();
    const { error } = await admin.from("notifications").insert(
      pending.map(({ recipientId, draft }) => ({
        organization_id: input.organizationId,
        recipient_id: recipientId,
        type: draft.type,
        title: truncate(draft.title, MAX_TITLE),
        body: draft.body ? truncate(draft.body, MAX_BODY) : null,
        link: draft.link ?? null,
      })),
    );

    if (error) {
      console.error("[notifications] falha ao gravar:", error.message);
      return 0;
    }
    return pending.length;
  } catch (error) {
    console.error("[notifications] erro inesperado no envio:", error);
    return 0;
  }
}
