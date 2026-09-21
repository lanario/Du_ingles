import "server-only";
import { agendaPath } from "@/lib/google/paths";
import { isGoogleConfigured } from "@/lib/env";
import { decryptSecret, encryptSecret } from "@/lib/google/crypto";
import { GoogleAuthError, refreshAccessToken, revokeToken } from "@/lib/google/oauth";
import { dispatchNotifications } from "@/lib/notifications/dispatch";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { AppRole } from "@/types/domain";

/**
 * A conexão Google de cada usuário: guardar, consultar, renovar o acesso e
 * desfazer. O refresh token só existe em claro dentro destas funções.
 */

export interface GoogleStatus {
  /** `false` quando as credenciais não estão configuradas: a UI esconde o botão. */
  available: boolean;
  connected: boolean;
  /** Já foi conectado, mas o Google recusou o token — precisa reconectar. */
  revoked: boolean;
}

export async function googleStatus(profileId: string): Promise<GoogleStatus> {
  if (!isGoogleConfigured())
    return { available: false, connected: false, revoked: false };

  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("google_connections")
    .select("status")
    .eq("profile_id", profileId)
    .maybeSingle();

  return {
    available: true,
    connected: data?.status === "active",
    revoked: data?.status === "revoked",
  };
}

export async function saveConnection(input: {
  profileId: string;
  organizationId: string;
  refreshToken: string;
  scope: string;
}): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("google_connections").upsert(
    {
      profile_id: input.profileId,
      organization_id: input.organizationId,
      refresh_token_enc: encryptSecret(input.refreshToken),
      scope: input.scope,
      status: "active",
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id" },
  );
  if (error) throw new Error(`Falha ao salvar a conexão Google: ${error.message}`);
}

/** Perfis com conexão ativa, entre os ids pedidos. */
export async function connectedProfiles(ids: readonly string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("google_connections")
    .select("profile_id")
    .in("profile_id", [...ids])
    .eq("status", "active");
  return new Set((data ?? []).map((row) => row.profile_id));
}

async function markRevoked(profileId: string, organizationId: string, role: AppRole) {
  const admin = createAdminSupabaseClient();
  await admin
    .from("google_connections")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("profile_id", profileId);

  await dispatchNotifications({
    organizationId,
    recipients: [{ id: profileId, role, name: "" }],
    dedupe: { withinMinutes: 24 * 60 },
    build: () => ({
      type: "google_disconnected",
      title: "Reconecte seu Google Agenda",
      body: "O Google recusou o acesso à sua agenda. Reconecte para continuar recebendo as aulas.",
      link: agendaPath(role),
    }),
  });
}

/**
 * Access token novo, ou `null` se o usuário não tem conexão ativa. Se o Google
 * recusar o refresh token (revogado, senha trocada, app removido), a conexão é
 * marcada como revogada e o usuário é avisado — sem lançar: quem chama é uma
 * sincronização que não pode derrubar a ação de origem.
 */
export async function accessTokenFor(
  profileId: string,
  role: AppRole,
): Promise<string | null> {
  if (!isGoogleConfigured()) return null;

  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("google_connections")
    .select("refresh_token_enc, organization_id, status")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!data || data.status !== "active") return null;

  try {
    return await refreshAccessToken(decryptSecret(data.refresh_token_enc));
  } catch (error) {
    if (error instanceof GoogleAuthError) {
      await markRevoked(profileId, data.organization_id, role);
    } else {
      console.error("[google] falha ao renovar o acesso:", error);
    }
    return null;
  }
}

/**
 * Revoga o acesso no Google e apaga a conexão. Os eventos já criados na agenda
 * são apagados por `disconnectAndCleanup` (sync.ts), que roda antes desta.
 */
export async function deleteConnection(profileId: string): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("google_connections")
    .select("refresh_token_enc")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (data) {
    try {
      await revokeToken(decryptSecret(data.refresh_token_enc));
    } catch {
      /* token ilegível: segue e apaga a linha */
    }
  }
  await admin.from("google_connections").delete().eq("profile_id", profileId);
}
