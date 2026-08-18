import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/types/database.types";

/**
 * Client anônimo sem leitura de cookies — usado em conteúdo público que
 * precisa continuar estático (landing page). `createServerSupabaseClient()`
 * chama `cookies()` internamente, o que força a rota inteira a virar
 * dinâmica no Next.js; este client evita isso para leituras que não
 * dependem de sessão (RLS ainda protege via policies para `anon`).
 */
export function createPublicSupabaseClient() {
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
