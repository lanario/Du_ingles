import { NextResponse, type NextRequest } from "next/server";

/**
 * Destino do link enviado por `resetPasswordForEmail`. NÃO consome o token:
 * scanners de e-mail (Safe Links, prefetch) fazem GET no link e queimariam o
 * OTP de uso único. A verificação acontece no navegador, em `/redefinir-senha`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  // Só caminho interno: `//host` e `https://host` virariam open redirect.
  const requestedNext = searchParams.get("next") ?? "";
  const next = /^\/(?![/\\])/.test(requestedNext) ? requestedNext : "/redefinir-senha";

  if (tokenHash && type === "recovery") {
    const url = new URL(next, origin);
    url.searchParams.set("token_hash", tokenHash);
    url.searchParams.set("type", type);
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(new URL("/recuperar-senha?error=invalid_link", origin));
}
