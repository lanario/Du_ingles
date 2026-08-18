import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import type { Database } from "@/types/database.types";

/**
 * Client para uso em Server Components, Server Actions e Route Handlers.
 * Sempre valide identidade com `supabase.auth.getUser()` — nunca `getSession()`
 * no servidor, pois `getSession()` lê o cookie sem revalidar a assinatura
 * do JWT junto ao servidor de auth (ver §3.2 do planejamento técnico).
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Chamado a partir de um Server Component: os cookies já foram
            // enviados. O middleware é responsável por refrescar a sessão
            // nesse caso — este catch evita que o render quebre.
          }
        },
      },
    },
  );
}
