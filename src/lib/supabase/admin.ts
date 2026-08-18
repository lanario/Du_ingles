import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env, requireServiceRoleKey } from "@/lib/env";
import type { Database } from "@/types/database.types";

/**
 * Client com service-role key. Ignora RLS por completo.
 *
 * Uso restrito a: criação de usuário pelo admin (`auth.admin.createUser`),
 * revogação global de sessão (`auth.admin.signOut`) e geração de signed URLs
 * quando a checagem de permissão já foi feita explicitamente antes.
 *
 * `import "server-only"` faz o build falhar caso este módulo seja importado,
 * direta ou indiretamente, por qualquer código que chegue ao bundle do cliente.
 */
export function createAdminSupabaseClient() {
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, requireServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
