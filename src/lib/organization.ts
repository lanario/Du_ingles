import "server-only";
import { cache } from "react";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * Hoje o Du Inglês opera como escola única — não há seletor de org na UI.
 * Isolar essa busca aqui (em vez de espalhar o slug 'du-ingles' pelo código)
 * é o que torna trivial virar multi-tenant depois (§4.1, §5.4).
 */
export const getDefaultOrganizationId = cache(async (): Promise<string> => {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", "du-ingles")
    .single();

  if (error || !data) {
    throw new Error("Organização padrão não encontrada.");
  }
  return data.id;
});

/** Nome de exibição da organização — usado nos cabeçalhos do painel. */
export const getOrganizationName = cache(async (id: string): Promise<string> => {
  const admin = createAdminSupabaseClient();
  const { data } = await admin.from("organizations").select("name").eq("id", id).single();

  return data?.name ?? "Du Inglês";
});
