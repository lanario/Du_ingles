import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface LibraryEntry {
  id: string;
  groupId: string;
  groupName: string;
  title: string;
  scheduledAt: string;
  hasPdf: boolean;
}

/**
 * RLS já resolve quem vê o quê: aluno só sessões publicadas das turmas em
 * que está matriculado; professor, as próprias. Um único caminho de
 * código serve os dois — mesma ideia de `listMyUpcomingSessions`.
 */
export async function listLibraryEntries(groupId?: string): Promise<LibraryEntry[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("class_sessions")
    .select("id, group_id, title, scheduled_at, pdf_path, group:group_id(name)")
    .eq("is_published", true)
    .order("scheduled_at", { ascending: false });

  if (groupId) query = query.eq("group_id", groupId);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    groupId: row.group_id,
    groupName: row.group?.name ?? "—",
    title: row.title,
    scheduledAt: row.scheduled_at,
    hasPdf: !!row.pdf_path,
  }));
}

export async function listMyGroupsForFilter(): Promise<{ id: string; name: string }[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("groups").select("id, name").order("name");
  return data ?? [];
}
