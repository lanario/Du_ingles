import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import type { AppRole } from "@/types/domain";

const PUBLIC_PATHS = ["/login", "/recuperar-senha", "/redefinir-senha"];
const FORCED_PASSWORD_PATH = "/definir-senha";
const ADMIN_PREFIX = "/admin";
const TEACHER_PREFIX = "/professor";
const PROTECTED_PREFIXES = [
  ADMIN_PREFIX,
  TEACHER_PREFIX,
  "/dashboard",
  FORCED_PASSWORD_PATH,
];

function roleHomePath(role: AppRole): string {
  if (role === "admin") return "/admin";
  if (role === "teacher") return "/professor";
  return "/dashboard";
}

/**
 * O middleware roda em TODA navegação — inclusive nos requests RSC de uma
 * troca de rota do lado do cliente. Cada round-trip aqui entra inteiro no
 * tempo até o primeiro byte, antes de o Next sequer começar a renderizar, e
 * se multiplica pelo número de usuários simultâneos. Por isso ele não lê mais
 * o banco: quem decide papel e senha provisória é `requireRole`
 * (`src/lib/auth/session.ts`), que já carrega a linha de `profiles` no render
 * e é a fronteira de autorização de verdade — metade das rotas do aluno
 * (`/tarefas`, `/turmas`, `/biblioteca`…) nunca esteve em
 * `PROTECTED_PREFIXES` e sempre dependeu dele.
 *
 * O que sobra aqui é o barato: CSP com nonce, renovação do cookie de sessão
 * e o corte grosso de quem não está autenticado.
 */
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

  const pathname = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const redirectTo = (path: string) => {
    const target = NextResponse.redirect(new URL(path, request.url));
    target.headers.set("Content-Security-Policy", csp);
    return target;
  };

  /**
   * Visitante anônimo na vitrine: sem cookie `sb-*` não há sessão para
   * renovar nem identidade para conferir, e falar com o Supabase só para
   * ouvir "ninguém" custaria um round-trip em cada request da landing.
   */
  const hasAuthCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-"));
  if (!hasAuthCookie) {
    return isProtected ? redirectTo("/login") : response;
  }

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

  /**
   * `getClaims()` confere a assinatura do JWT com a chave pública do projeto
   * dentro do próprio edge (JWKS em cache), sem ida ao servidor de auth —
   * mesma garantia do `getUser()` por uma fração do custo. Em projeto ainda
   * com segredo simétrico (HS256) a própria biblioteca cai de volta no
   * `getUser()`, então trocar aqui nunca é menos seguro; para colher o ganho,
   * ligue as *signing keys* assimétricas no painel do Supabase. A renovação
   * do cookie continua acontecendo: `getClaims()` passa pelo `getSession()`,
   * que refresca o token vencido e dispara o `setAll` acima.
   */
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims ?? null;

  if (isProtected && !claims) {
    return redirectTo("/login");
  }

  const claimRole =
    claims && typeof claims["app_role"] === "string"
      ? (claims["app_role"] as AppRole)
      : null;

  if (isProtected && claimRole) {
    /**
     * Só cortamos quando a claim EXISTE e diverge. Ela depende do
     * `custom_access_token_hook` estar ligado nas Auth Hooks e só se atualiza
     * na renovação do token — tratar a ausência como "aluno" derrubaria um
     * admin em `/403` dentro do próprio painel. Sem claim, quem decide é o
     * `requireRole` do layout, que lê `profiles`.
     */
    if (pathname.startsWith(ADMIN_PREFIX) && claimRole !== "admin") {
      return redirectTo("/403");
    }
    // A área do professor é dele e da coordenação (que cai no próprio painel
    // pelo layout) — aluno nenhum entra aqui.
    if (
      pathname.startsWith(TEACHER_PREFIX) &&
      claimRole !== "teacher" &&
      claimRole !== "admin"
    ) {
      return redirectTo("/403");
    }
  }

  if (!isProtected && claims && PUBLIC_PATHS.includes(pathname)) {
    // Usuário já autenticado batendo em /login etc. — manda para o painel
    // correto. Se ainda precisar trocar a senha, a rota protegida seguinte
    // vai interceptar e mandar para /definir-senha.
    if (claimRole) return redirectTo(roleHomePath(claimRole));

    // Sem a claim sobra o banco — caminho raro (só quem já entrou volta ao
    // /login), então o round-trip aqui não pesa na navegação do dia a dia.
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", String(claims.sub))
      .single();
    const role = ((data as { role?: AppRole } | null)?.role ?? "student") as AppRole;
    return redirectTo(roleHomePath(role));
  }

  return response;
}

export const config = {
  matcher: [
    /**
     * `/api` fica de fora: cada route handler já autentica por conta própria
     * e o CSP não tem efeito sobre uma resposta JSON — o middleware ali só
     * adicionava latência a upload de avatar, PDF de relatório e webhook do
     * Stripe.
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)",
  ],
};
