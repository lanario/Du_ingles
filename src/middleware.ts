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

export async function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
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

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const claims = session ? decodeJwtClaims(session.access_token) : {};
    const appRole = (
      typeof claims["app_role"] === "string" ? claims["app_role"] : "student"
    ) as AppRole;

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
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const claims = session ? decodeJwtClaims(session.access_token) : {};
    const appRole = (
      typeof claims["app_role"] === "string" ? claims["app_role"] : "student"
    ) as AppRole;
    return redirectTo(roleHomePath(appRole));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
