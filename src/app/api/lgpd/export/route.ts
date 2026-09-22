import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { exportOwnData } from "@/repositories/lgpd";

/**
 * Cópia dos dados do titular (LGPD art. 18, II e V).
 *
 * É o dossiê inteiro de uma pessoa num único arquivo — se uma sessão for
 * sequestrada, é o que o invasor vai querer. Por isso cada download fica na
 * auditoria (com IP e navegador) e há um teto diário por conta.
 */
export async function GET() {
  const ctx = await requireRole(["admin", "teacher", "student"]);

  const allowed = await checkRateLimit(ctx.userId, "lgpd_export", 5, 86400);
  if (!allowed) {
    return NextResponse.json(
      {
        error:
          "Você já baixou seus dados várias vezes hoje. Tente de novo amanhã ou fale com a coordenação.",
      },
      { status: 429 },
    );
  }

  const data = await exportOwnData(ctx);

  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "LGPD_DATA_EXPORTED",
    entityType: "profile",
    entityId: ctx.userId,
  });

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="meus-dados-du-ingles-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
