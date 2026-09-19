import http from "k6/http";
import encoding from "k6/encoding";
import { check } from "k6";

/**
 * "qxkqndnvacwoqnvofsth.supabase.co" → "qxkqndnvacwoqnvofsth". É a mesma
 * derivação que o auth-js usa para o nome do cookie de sessão quando nenhum
 * storageKey é passado (nosso caso — ver src/lib/supabase/server.ts).
 */
function projectRefFromUrl(supabaseUrl) {
  const host = supabaseUrl.replace(/^https?:\/\//, "").split("/")[0];
  return host.split(".")[0];
}

/**
 * Autentica direto na API do Supabase (grant_type=password), sem passar pela
 * Server Action de login do app — que tem rate limit de 5 tentativas/15min
 * por IP+e-mail (src/actions/auth/login.ts) e não aguentaria autenticar uma
 * VU por iteração. Isso é aceitável aqui: o que queremos testar sob carga são
 * as páginas e ações que um usuário já logado usa, não o login em si (esse
 * fica isolado em scenarios/login-flow.js, que respeita o rate limit).
 *
 * Devolve o par {cookieName, cookieValue} pronto pra ir num cookie jar do k6,
 * no mesmo formato que @supabase/ssr grava (cookieEncoding "base64url", o
 * padrão da lib — ver node_modules/@supabase/ssr/dist/main/cookies.js).
 */
export function authenticate(supabaseUrl, anonKey, email, password) {
  const res = http.post(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email, password }),
    {
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
      },
      tags: { name: "supabase_auth_password_grant" },
    },
  );

  const ok = check(res, {
    "supabase auth: HTTP 200": (r) => r.status === 200,
  });
  if (!ok) {
    throw new Error(
      `Falha ao autenticar ${email} no Supabase: HTTP ${res.status} — ${res.body}`,
    );
  }

  const session = res.json();
  const cookieValue = "base64-" + encoding.b64encode(JSON.stringify(session), "rawurl");
  const cookieName = `sb-${projectRefFromUrl(supabaseUrl)}-auth-token`;

  // MAX_CHUNK_SIZE do @supabase/ssr é 3180 bytes (após encodeURIComponent).
  // Uma sessão normal (JWT + refresh_token + perfil do usuário) fica bem
  // abaixo disso — ver node_modules/@supabase/ssr/dist/main/utils/chunker.js.
  // Se algum dia o JWT crescer (mais custom claims) e estourar isso, o
  // middleware vai silenciosamente não reconhecer a sessão; o erro abaixo
  // avisa antes de gastar um load test inteiro com 401/redirect para /login.
  const encodedLength = encodeURIComponent(cookieValue).length;
  if (encodedLength > 3180) {
    throw new Error(
      `Cookie de sessão de ${email} tem ${encodedLength} bytes (após encodeURIComponent), ` +
        "acima do limite de chunk único do @supabase/ssr (3180). É preciso implementar " +
        "o chunking (sb-...-auth-token.0, .1, ...) antes de rodar o teste.",
    );
  }

  return { cookieName, cookieValue, email, role: null };
}
