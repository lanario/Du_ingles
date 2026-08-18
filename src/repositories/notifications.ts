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
