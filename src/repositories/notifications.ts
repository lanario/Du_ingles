import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

/**
 * `recipient_id` é filtrado aqui, explícito, e não só via RLS: a policy
 * `notifications_all_admin` dá `ALL` irrestrito a quem é admin (para a
 * escrita de service-role fazer sentido em `dispatch.ts`), então sem esse
 * filtro um admin logado recebe a caixa de todo mundo na própria — a leitura
 * "por conta própria" só existe para os outros papéis.
 */
export async function listNotifications(
  userId: string,
  limit = 20,
): Promise<NotificationItem[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    readAt: row.read_at,
    createdAt: row.created_at,
  }));
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const supabase = await createServerSupabaseClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .is("read_at", null);
  return count ?? 0;
}

/**
 * A escrita mora em `lib/notifications/dispatch.ts` (com o catálogo de
 * eventos em `events.ts`): ela precisa de service-role, resolve público por
 * papel e deduplica — este repositório fica só com a leitura da caixa de
 * quem está logado.
 */
