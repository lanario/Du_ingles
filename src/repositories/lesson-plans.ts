import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { CefrLevel } from "@/types/domain";
import type { Json } from "@/types/database.types";
import type {
  CreateLessonPlanInput,
  UpdateLessonPlanMetaInput,
} from "@/schemas/lesson-plans";

const EMPTY_DOC: Json = { type: "doc", content: [] };

export interface LessonPlanListItem {
  id: string;
  title: string;
  summary: string | null;
  level: CefrLevel;
  durationMinutes: number;
  isShared: boolean;
  isOwn: boolean;
  authorName: string;
  updatedAt: string;
}

export interface LessonPlanDetail extends LessonPlanListItem {
  content: Json;
  authorId: string;
}

/** RLS (`lesson_plans_select_own_or_shared`) já filtra: próprios + compartilhados. */
export async function listLessonPlans(
  userId: string,
  search?: string,
): Promise<LessonPlanListItem[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("lesson_plans")
    .select(
      "id, title, summary, level, duration_minutes, is_shared, author_id, updated_at, author:author_id(full_name)",
    )
    .order("updated_at", { ascending: false });

  if (search) {
    query = query.textSearch("search_vector", search, { type: "websearch" });
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    level: row.level,
    durationMinutes: row.duration_minutes,
    isShared: row.is_shared,
    isOwn: row.author_id === userId,
    authorName: row.author?.full_name ?? "—",
    updatedAt: row.updated_at,
  }));
}

export async function getLessonPlanById(
  id: string,
  userId: string,
): Promise<LessonPlanDetail | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("lesson_plans")
    .select(
      "id, title, summary, level, duration_minutes, is_shared, author_id, content, updated_at, author:author_id(full_name)",
    )
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    title: data.title,
    summary: data.summary,
    level: data.level,
    durationMinutes: data.duration_minutes,
    isShared: data.is_shared,
    isOwn: data.author_id === userId,
    authorName: data.author?.full_name ?? "—",
    authorId: data.author_id,
    content: data.content,
    updatedAt: data.updated_at,
  };
}

export async function createLessonPlan(
  input: CreateLessonPlanInput,
  organizationId: string,
  authorId: string,
): Promise<{ success: boolean; id?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("lesson_plans")
    .insert({
      organization_id: organizationId,
      author_id: authorId,
      title: input.title,
      summary: input.summary ?? null,
      level: input.level as CefrLevel,
      duration_minutes: input.durationMinutes,
      content: EMPTY_DOC,
    })
    .select("id")
    .single();

  return { success: !error && !!data, id: data?.id };
}

export async function updateLessonPlanContent(
  id: string,
  content: Json,
): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("lesson_plans").update({ content }).eq("id", id);
  return !error;
}

export async function updateLessonPlanMeta(
  id: string,
  input: UpdateLessonPlanMetaInput,
): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("lesson_plans")
    .update({
      title: input.title,
      summary: input.summary ?? null,
      level: input.level as CefrLevel,
      duration_minutes: input.durationMinutes,
      is_shared: input.isShared,
    })
    .eq("id", id);
  return !error;
}

export async function duplicateLessonPlan(
  id: string,
  organizationId: string,
  authorId: string,
): Promise<{ success: boolean; id?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: original, error: fetchError } = await supabase
    .from("lesson_plans")
    .select("title, summary, level, duration_minutes, objectives, content, tags")
    .eq("id", id)
    .single();

  if (fetchError || !original) return { success: false };

  const { data, error } = await supabase
    .from("lesson_plans")
    .insert({
      organization_id: organizationId,
      author_id: authorId,
      title: `${original.title} (cópia)`,
      summary: original.summary,
      level: original.level,
      duration_minutes: original.duration_minutes,
      objectives: original.objectives,
      content: original.content,
      tags: original.tags,
    })
    .select("id")
    .single();

  return { success: !error && !!data, id: data?.id };
}

export async function deleteLessonPlan(id: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("lesson_plans").delete().eq("id", id);
  return !error;
}
