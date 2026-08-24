import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { verifyViewAsToken } from "@/lib/auth/view-as-token";
import type { AppRole } from "@/types/domain";

export const VIEW_AS_COOKIE = "du_view_as";

export interface SessionContext {
  userId: string;
  email: string;
  /** Papel verdadeiro, lido do JWT (claim `app_role`). */
  realRole: AppRole;
  /** Papel efetivo exibido — vira `teacher` durante o modo "ver como". */
  effectiveRole: AppRole;
  /** Sessão em modo "ver como": somente leitura. */
  isViewAs: boolean;
  organizationId: string;
  mustChangePassword: boolean;
  /** Nome exibido no menu da conta — cai para a parte local do e-mail. */
  fullName: string;
  /** URL relativa da foto de perfil (`/api/avatars/...`) ou `null`. */
  avatarUrl: string | null;
}

function decodeJwtClaims(accessToken: string): Record<string, unknown> {
  const payload = accessToken.split(".")[1];
  if (!payload) return {};
  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return JSON.parse(atob(padded)) as Record<string, unknown>;
}

/**
 * `cache()` do React deduplica a chamada dentro do mesmo render pass —
 * sem isso, cada componente que checa a sessão dispara um round-trip novo
 * ao Supabase (§3.2).
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createServerSupabaseClient();
  // getUser() revalida a assinatura do JWT contra o servidor de auth.
  // getSession() NÃO faz essa revalidação — nunca usar no servidor.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const claims = session ? decodeJwtClaims(session.access_token) : {};

  // `profiles` é a fonte da verdade do papel — não o JWT. A claim `app_role`
  // só existe se o `custom_access_token_hook` estiver ligado nas Auth Hooks do
  // projeto, e mesmo ligado ela só muda na renovação do token: promover
  // alguém a admin ficaria invisível até o refresh. Ler o perfil não custa
  // round-trip novo (a query de `must_change_password` já acontecia aqui);
  // as claims ficam só como fallback caso a linha não exista.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id, must_change_password, full_name, avatar_url")
    .eq("id", user.id)
    .single();

  const claimRole = typeof claims["app_role"] === "string" ? claims["app_role"] : null;
  const claimOrg = typeof claims["org_id"] === "string" ? claims["org_id"] : null;

  const realRole = (profile?.role ?? claimRole ?? "student") as AppRole;
  const organizationId = profile?.organization_id ?? claimOrg ?? "";

  let effectiveRole = realRole;
  let isViewAs = false;

  if (realRole === "admin") {
    const cookieStore = await cookies();
    const token = cookieStore.get(VIEW_AS_COOKIE)?.value;
    if (token) {
      const payload = await verifyViewAsToken(token);
      if (payload) {
        effectiveRole = payload.role;
        isViewAs = true;
      }
    }
  }

  return {
    userId: user.id,
    email: user.email ?? "",
    realRole,
    effectiveRole,
    isViewAs,
    organizationId,
    mustChangePassword: profile?.must_change_password ?? false,
    fullName: profile?.full_name || (user.email ?? "").split("@")[0] || "Minha conta",
    avatarUrl: profile?.avatar_url ? `/api/avatars/${profile.avatar_url}` : null,
  };
});

/** Admin é o papel de maior privilégio: nenhuma tela ou escrita lhe é negada. */
export function isAdmin(ctx: SessionContext): boolean {
  return ctx.realRole === "admin";
}

/**
 * Autentica e autoriza no servidor. Aceita o papel efetivo (para que o admin
 * navegando como professor/aluno veja as mesmas telas deles) e o papel real.
 *
 * Admin passa sempre — trocar de contexto é uma lente sobre a interface, não
 * um rebaixamento de privilégio.
 */
export async function requireRole(allowed: AppRole[]): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  if (
    !isAdmin(ctx) &&
    !allowed.includes(ctx.effectiveRole) &&
    !allowed.includes(ctx.realRole)
  ) {
    redirect("/403");
  }
  return ctx;
}
