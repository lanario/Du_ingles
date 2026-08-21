import { unstable_cache } from "next/cache";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

export interface PublicTeacher {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  bio: string | null;
  specialties: string[];
}

/**
 * Só professores com `is_public = true` — RLS cobre isso (migration 0005).
 *
 * A landing é renderizada por request (exigência do CSP com nonce, ver
 * `src/app/layout.tsx`), então o cache que antes vinha do `revalidate` da rota
 * mora aqui: a query real acontece no máximo uma vez por hora, o resto das
 * visitas lê do cache de dados.
 */
export const listPublicTeachers = unstable_cache(
  fetchPublicTeachers,
  ["public-teachers"],
  { revalidate: 3600, tags: ["public-teachers"] },
);

async function fetchPublicTeachers(): Promise<PublicTeacher[]> {
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
