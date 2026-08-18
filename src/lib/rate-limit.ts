import "server-only";
import { headers } from "next/headers";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * `check_rate_limit` teve o EXECUTE revogado de anon/authenticated (ver
 * migration 0002) — só o service-role pode chamá-la, então este helper
 * sempre passa pelo client admin.
 */
export async function checkRateLimit(
  identifier: string,
  action: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.rpc("check_rate_limit", {
    p_identifier: identifier,
    p_action: action,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    // Falha aberta seria pior que falha fechada aqui: se o rate limiter
    // cair, negar a ação é mais seguro que permitir tráfego ilimitado.
    return false;
  }
  return data ?? false;
}

/** IP do cliente a partir dos headers de proxy (Vercel/CDN). */
export async function getClientIp(): Promise<string> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) {
    const [first] = forwardedFor.split(",");
    if (first) return first.trim();
  }
  return headerList.get("x-real-ip") ?? "unknown";
}
