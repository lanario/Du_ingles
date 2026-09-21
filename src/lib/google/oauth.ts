import "server-only";
import { env, requireGoogleCredentials } from "@/lib/env";

/**
 * OAuth 2.0 (fluxo de código, acesso offline) por `fetch`, sem SDK.
 *
 * Escopo mínimo: `calendar.events.owned` — criar, mudar e apagar eventos das
 * agendas de que a pessoa é dona. Não lê a lista de agendas nem eventos de
 * terceiros, que é o que a política de privacidade promete.
 */

/** Cookie que amarra o retorno do Google a quem iniciou a conexão (anti-CSRF). */
export const STATE_COOKIE = "google_oauth_state";

export const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.events.owned";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

/** Refresh token revogado ou expirado: a conexão precisa ser refeita pelo usuário. */
export class GoogleAuthError extends Error {}

export function siteUrl(): string {
  return env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
}

/** Tem de bater, caractere por caractere, com a URI cadastrada no Google Cloud. */
export function redirectUri(): string {
  return `${siteUrl()}/api/google/callback`;
}

export function buildAuthUrl(state: string): string {
  const { clientId } = requireGoogleCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPE,
    // `offline` + `consent` é o que garante um refresh token a cada conexão.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  error?: string;
}

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  const { clientId, clientSecret } = requireGoogleCredentials();
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      ...body,
    }),
    cache: "no-store",
  });
  const json = (await response.json().catch(() => ({}))) as TokenResponse;
  if (!response.ok) {
    if (json.error === "invalid_grant") throw new GoogleAuthError("invalid_grant");
    throw new Error(
      `Google token endpoint: ${response.status} ${json.error ?? ""}`.trim(),
    );
  }
  return json;
}

export async function exchangeCode(code: string): Promise<{
  refreshToken: string;
  scope: string;
}> {
  const json = await postToken({
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri(),
  });
  if (!json.refresh_token) throw new Error("Google não devolveu refresh token.");
  return { refreshToken: json.refresh_token, scope: json.scope ?? GOOGLE_SCOPE };
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const json = await postToken({
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  if (!json.access_token) throw new Error("Google não devolveu access token.");
  return json.access_token;
}

/** Melhor esforço: se falhar, o usuário ainda pode revogar em myaccount.google.com/permissions. */
export async function revokeToken(token: string): Promise<void> {
  try {
    await fetch(REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
      cache: "no-store",
    });
  } catch {
    /* segue: a conexão local é apagada de qualquer jeito */
  }
}
