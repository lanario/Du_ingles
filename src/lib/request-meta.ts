import "server-only";
import { isIP } from "node:net";
import { headers } from "next/headers";

export interface RequestMeta {
  /** `null` quando não dá para confiar no valor — a coluna é `inet`. */
  ip: string | null;
  userAgent: string | null;
}

/**
 * IP e user-agent de quem fez a requisição, para trilhas que precisam
 * demonstrar diligência (auditoria, prova de consentimento — LGPD art. 8 §2,
 * art. 37 e art. 48).
 *
 * Nunca lança: fora de um request (job, script) `headers()` falha, e um
 * registro sem IP é melhor que registro nenhum.
 */
export async function getRequestMeta(): Promise<RequestMeta> {
  try {
    const list = await headers();
    const forwarded = list.get("x-forwarded-for")?.split(",")[0]?.trim();
    const candidate = forwarded || list.get("x-real-ip")?.trim() || "";
    const userAgent = list.get("user-agent");
    return {
      ip: isIP(candidate) ? candidate : null,
      userAgent: userAgent ? userAgent.slice(0, 512) : null,
    };
  } catch {
    return { ip: null, userAgent: null };
  }
}
