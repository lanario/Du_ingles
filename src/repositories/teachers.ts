import { createPublicSupabaseClient } from "@/lib/supabase/public";

export interface PublicTeacher {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  bio: string | null;
  specialties: string[];
}

/** Só professores com `is_public = true` — RLS cobre isso (migration 0005). */
export async function listPublicTeachers(): Promise<PublicTeacher[]> {
  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase
    .from("teacher_profiles")
    .select("bio, specialties, profiles!inner(id, full_name, avatar_url)")
    .eq("is_public", true)
    .limit(12);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.profiles.id,
    fullName: row.profiles.full_name,
    avatarUrl: row.profiles.avatar_url,
    bio: row.bio,
    specialties: row.specialties,
  }));
}
