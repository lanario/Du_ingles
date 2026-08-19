import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import type { AppRole } from "@/types/domain";

const PUBLIC_PATHS = ["/login", "/recuperar-senha", "/redefinir-senha"];
const FORCED_PASSWORD_PATH = "/definir-senha";
const ADMIN_PREFIX = "/admin";
const PROTECTED_PREFIXES = [ADMIN_PREFIX, "/dashboard", FORCED_PASSWORD_PATH];

function decodeJwtClaims(accessToken: string): Record<string, unknown> {
  const payload = accessToken.split(".")[1];
  if (!payload) return {};
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function roleHomePath(role: AppRole): string {
  return role === "admin" ? "/admin" : "/dashboard";
}

/**
 * Mesma regra do `getSessionContext`: `profiles.role` manda, a claim
 * `app_role` é só fallback. A claim depende do `custom_access_token_hook`
 * estar ligado nas Auth Hooks do projeto e só se atualiza na renovação do
 * token — confiar nela sozinha derruba um admin em `/403` no próprio painel.
 */
async function resolveRole(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
): Promise<AppRole> {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).single();
  const profileRole = (data as { role?: AppRole } | null)?.role;
  if (profileRole) return profileRole;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const claims = session ? decodeJwtClaims(session.access_token) : {};
  return (
    typeof claims["app_role"] === "string" ? claims["app_role"] : "student"
  ) as AppRole;
}

export async function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  // O Fast Refresh do `next dev` injeta o runtime via `eval()` (devtool
  // `eval-source-map` do webpack) — sem 'unsafe-eval' aqui, o CSP mata a
  // hidratação inteira da página em dev. Em produção o build não usa eval,
  // então a política fica tão restrita quanto antes.
  const isDev = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "font-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          response.headers.set("Content-Security-Policy", csp);
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const redirectTo = (path: string) => {
    const target = NextResponse.redirect(new URL(path, request.url));
    target.headers.set("Content-Security-Policy", csp);
    return target;
  };

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isProtected) {
    if (!user) {
      return redirectTo("/login");
    }

    const appRole = await resolveRole(supabase, user.id);

    if (pathname !== FORCED_PASSWORD_PATH) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("must_change_password")
        .eq("id", user.id)
        .single();

      if (profile?.must_change_password) {
        return redirectTo(FORCED_PASSWORD_PATH);
      }
    }

    if (pathname.startsWith(ADMIN_PREFIX) && appRole !== "admin") {
      return redirectTo("/403");
    }
  } else if (user && PUBLIC_PATHS.includes(pathname)) {
    // Usuário já autenticado batendo em /login etc. — manda para o painel
    // correto. Se ainda precisar trocar a senha, a rota protegida seguinte
    // vai interceptar e mandar para /definir-senha.
    const appRole = await resolveRole(supabase, user.id);
    return redirectTo(roleHomePath(appRole));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
