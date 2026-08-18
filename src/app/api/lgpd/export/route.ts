import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { exportOwnData } from "@/repositories/lgpd";

export async function GET() {
  const ctx = await requireRole(["admin", "teacher", "student"]);
  const data = await exportOwnData(ctx);

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="meus-dados-du-ingles-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
