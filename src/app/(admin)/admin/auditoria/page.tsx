import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { listAuditLogs } from "@/repositories/audit";
import { AuditView } from "@/components/features/admin/audit/audit-view";

export const metadata: Metadata = { title: "Auditoria" };

/**
 * Trilha de auditoria da organização.
 *
 * A janela vem inteira do servidor (busca, categoria e período são filtros
 * locais): são poucas centenas de linhas já resolvidas com nomes, e filtrar
 * em memória responde na hora — sem round-trip a cada tecla.
 */
const LIMIT = 200;

export default async function AuditoriaPage() {
  const ctx = await requireRole(["admin"]);
  const logs = await listAuditLogs(ctx.organizationId, LIMIT);

  return <AuditView logs={logs} limit={LIMIT} />;
}
