import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/domain";

export interface SessionContext {
  userId: string;
  email: string;
  /** Papel verdadeiro, lido do JWT (claim `app_role`). */
  realRole: AppRole;
  /** Papel efetivo exibido. O modo "ver como" foi descontinuado — hoje é
   * sempre igual a `realRole`, mantido só para não reescrever cada tela que
   * já lê `effectiveRole`. */
  effectiveRole: AppRole;
  /** Sempre `false` — o modo "ver como" foi descontinuado. */
  isViewAs: boolean;
  organizationId: string;
  mustChangePassword: boolean;
  /** Nome exibido no menu da conta — cai para a parte local do e-mail. */
  fullName: string;
  /** URL relativa da foto de perfil (`/api/avatars/...`) ou `null`. */
  avatarUrl: string | null;
}

/**
 * `cache()` do React deduplica a chamada dentro do mesmo render pass —
 * sem isso, cada componente que checa a sessão dispara um round-trip novo
 * ao Supabase (§3.2).
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createServerSupabaseClient();
  /**
   * `getClaims()` valida a assinatura do JWT contra a chave pública do
   * projeto (JWKS em cache no processo) — mesma garantia do `getUser()`, que
   * ia até o servidor de auth a cada render, sem o round-trip. Nunca
   * `getSession()` sozinho: aquele lê o cookie e acredita nele. Em projeto
   * ainda com segredo simétrico (HS256) a biblioteca cai de volta no
   * `getUser()` por dentro, então a troca não afrouxa nada; ligar as
   * *signing keys* assimétricas no Supabase é o que a converte em latência
   * zero.
   */
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims ?? null;
  if (!claims?.sub) return null;

  const userId = String(claims.sub);
  const userEmail = typeof claims["email"] === "string" ? claims["email"] : "";

  // `profiles` é a fonte da verdade do papel — não o JWT. A claim `app_role`
  // só existe se o `custom_access_token_hook` estiver ligado nas Auth Hooks do
  // projeto, e mesmo ligado ela só muda na renovação do token: promover
  // alguém a admin ficaria invisível até o refresh. As claims ficam só como
  // fallback caso a linha não exista.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id, must_change_password, full_name, avatar_url")
    .eq("id", userId)
    .single();

  const claimRole = typeof claims["app_role"] === "string" ? claims["app_role"] : null;
  const claimOrg = typeof claims["org_id"] === "string" ? claims["org_id"] : null;

  const realRole = (profile?.role ?? claimRole ?? "student") as AppRole;
  const organizationId = profile?.organization_id ?? claimOrg ?? "";

  return {
    userId,
    email: userEmail,
    realRole,
    effectiveRole: realRole,
    isViewAs: false,
    organizationId,
    mustChangePassword: profile?.must_change_password ?? false,
    fullName: profile?.full_name || userEmail.split("@")[0] || "Minha conta",
    avatarUrl: profile?.avatar_url ? `/api/avatars/${profile.avatar_url}` : null,
  };
});

/** Admin é o papel de maior privilégio: nenhuma tela ou escrita lhe é negada. */
export function isAdmin(ctx: SessionContext): boolean {
  return ctx.realRole === "admin";
}

/**
 * Autentica e autoriza no servidor. Admin passa sempre — é o papel de maior
 * privilégio —, mas cada área logada (`(app)`, `(teacher)`) barra o admin na
 * própria entrada do layout, então essa checagem só importa para as telas
 * explicitamente compartilhadas (ex.: `requireRole(["admin", "teacher", ...])`).
 *
 * A senha provisória também é barrada aqui. Antes quem barrava era o
 * middleware, com uma consulta a `profiles` por request só para ler
 * `must_change_password`; a linha já vem inteira no `getSessionContext`, então
 * o mesmo bloqueio sai de graça no render — e passa a valer para todas as
 * rotas do aluno, que nunca estiveram na lista de prefixos do middleware.
 */
export async function requireRole(allowed: AppRole[]): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  if (ctx.mustChangePassword) redirect("/definir-senha");
  if (!isAdmin(ctx) && !allowed.includes(ctx.realRole)) {
    redirect("/403");
  }
  return ctx;
}
