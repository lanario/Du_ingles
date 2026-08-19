import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export async function listNotifications(limit = 20): Promise<NotificationItem[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at")
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

export async function countUnreadNotifications(): Promise<number> {
  const supabase = await createServerSupabaseClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  return count ?? 0;
}

/**
 * Notifica outro usuario. Vai por service-role porque `notifications` so tem
 * policy de select/update para o proprio destinatario — nenhum cliente pode
 * escrever na caixa de outra pessoa (secao 5.3).
 */
export async function createNotification(input: {
  organizationId: string;
  recipientId: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
}): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("notifications").insert({
    organization_id: input.organizationId,
    recipient_id: input.recipientId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
  });
  return !error;
}
