import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { isGoogleConfigured } from "@/lib/env";
import { agendaPath } from "@/lib/google/paths";
import { buildAuthUrl, siteUrl, STATE_COOKIE } from "@/lib/google/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Início da conexão. É um link (`<a href>`), não um formulário: o CSP da
 * plataforma tem `form-action 'self'`, e um redirect de navegação para o
 * Google passa por ele sem problema.
 */
export async function GET() {
  const ctx = await requireRole(["admin", "teacher", "student"]);
  const back = `${siteUrl()}${agendaPath(ctx.realRole)}`;

  if (!isGoogleConfigured()) {
    return NextResponse.redirect(`${back}?google=indisponivel`);
  }

  const state = randomBytes(24).toString("base64url");
  const response = NextResponse.redirect(buildAuthUrl(state));
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/google",
    maxAge: 600,
  });
  return response;
}
