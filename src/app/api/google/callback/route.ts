import { timingSafeEqual } from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit";
import { PRIVACY_POLICY_VERSION, recordConsent } from "@/lib/consent/record";
import { isGoogleConfigured } from "@/lib/env";
import { saveConnection } from "@/lib/google/connection";
import { exchangeCode, siteUrl, STATE_COOKIE } from "@/lib/google/oauth";
import { agendaPath } from "@/lib/google/paths";
import { backfillForProfile } from "@/lib/google/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sameState(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Retorno do Google: troca o código por um refresh token e o guarda cifrado. */
export async function GET(request: NextRequest) {
  const ctx = await requireRole(["admin", "teacher", "student"]);
  const back = `${siteUrl()}${agendaPath(ctx.realRole)}`;

  const done = (result: string) => {
    const response = NextResponse.redirect(`${back}?google=${result}`);
    response.cookies.delete({ name: STATE_COOKIE, path: "/api/google" });
    return response;
  };

  if (!isGoogleConfigured()) return done("indisponivel");

  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const expected = request.cookies.get(STATE_COOKIE)?.value;

  // Usuário clicou em "Cancelar" na tela do Google.
  if (params.get("error")) return done("cancelado");
  if (!code || !state || !expected || !sameState(state, expected)) return done("erro");

  try {
    const { refreshToken, scope } = await exchangeCode(code);
    await saveConnection({
      profileId: ctx.userId,
      organizationId: ctx.organizationId,
      refreshToken,
      scope,
    });
  } catch (error) {
    console.error("[google] falha ao concluir a conexão:", error);
    return done("erro");
  }

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "GOOGLE_CALENDAR_CONNECTED",
    entityType: "profile",
    entityId: ctx.userId,
  });
  await recordConsent({
    organizationId: ctx.organizationId,
    purpose: "google_calendar",
    granted: true,
    documentVersion: PRIVACY_POLICY_VERSION,
    subjectId: ctx.userId,
    subjectEmail: ctx.email,
  });

  after(() => backfillForProfile(ctx.userId, ctx.realRole));
  return done("conectado");
}
