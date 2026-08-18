import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { CefrLevel } from "@/types/domain";
import type { CreateCourseInput } from "@/schemas/courses";

export interface Course {
  id: string;
  name: string;
  description: string | null;
  level: CefrLevel;
  totalHours: number | null;
  isActive: boolean;
}

/** Passa pela RLS normal (`courses_select_org`) — qualquer autenticado da org lê. */
export async function listCourses(): Promise<Course[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("courses")
    .select("id, name, description, level, total_hours, is_active")
    .eq("is_active", true)
    .order("name");

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    level: row.level,
    totalHours: row.total_hours,
    isActive: row.is_active,
  }));
}

export async function createCourse(
  input: CreateCourseInput,
  organizationId: string,
): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("courses").insert({
    organization_id: organizationId,
    name: input.name,
    description: input.description ?? null,
    level: input.level as CefrLevel,
    total_hours: input.totalHours ?? null,
  });
  return !error;
}
