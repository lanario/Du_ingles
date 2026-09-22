import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { listLgpdQueue } from "@/repositories/lgpd-requests";
import { LgpdQueueView } from "@/components/features/admin/lgpd/lgpd-queue-view";

export const metadata: Metadata = { title: "Pedidos LGPD" };

/**
 * Fila de pedidos de titulares (LGPD art. 18 e 19). Abertos primeiro, pelo
 * prazo legal; depois o histórico — que é o que demonstra, numa fiscalização,
 * que cada pedido foi respondido e como.
 */
export default async function LgpdQueuePage() {
  const ctx = await requireRole(["admin"]);
  const items = await listLgpdQueue(ctx.organizationId);

  return <LgpdQueueView items={items} currentUserId={ctx.userId} />;
}
