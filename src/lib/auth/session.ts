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

  const realRole = (
    typeof claims["app_role"] === "string" ? claims["app_role"] : "student"
  ) as AppRole;
  const organizationId = typeof claims["org_id"] === "string" ? claims["org_id"] : "";

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

  // must_change_password mora em `profiles`, não no JWT — precisa de uma
  // query extra, mas passa pela mesma policy `profiles_select_self`.
  const { data: profile } = await supabase
    .from("profiles")
    .select("must_change_password")
    .eq("id", user.id)
    .single();

  return {
    userId: user.id,
    email: user.email ?? "",
    realRole,
    effectiveRole,
    isViewAs,
    organizationId,
    mustChangePassword: profile?.must_change_password ?? false,
  };
});

/**
 * Autentica e autoriza no servidor. Aceita tanto o papel efetivo (para que
 * o admin em modo "ver como" veja as mesmas telas do professor) quanto o
 * papel real (para que o admin sempre consiga voltar ao próprio painel).
 */
export async function requireRole(allowed: AppRole[]): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  if (!allowed.includes(ctx.effectiveRole) && !allowed.includes(ctx.realRole)) {
    redirect("/403");
  }
  return ctx;
}

export class ReadOnlyModeError extends Error {
  constructor(message = "Modo de visualização é somente leitura.") {
    super(message);
    this.name = "ReadOnlyModeError";
  }
}

/** Chamar no início de toda Server Action de escrita. */
export function assertNotViewAs(ctx: SessionContext): void {
  if (ctx.isViewAs) {
    throw new ReadOnlyModeError();
  }
}
