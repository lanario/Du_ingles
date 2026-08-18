import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Destino do link enviado por `resetPasswordForEmail`. Troca o `token_hash`
 * por uma sessão de recovery (cookie) e só então redireciona para a tela
 * de definição de senha — assim o Server Action de lá já enxerga o usuário
 * autenticado via `getUser()`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/redefinir-senha";

  if (tokenHash && type) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/recuperar-senha?error=invalid_link", origin));
}
