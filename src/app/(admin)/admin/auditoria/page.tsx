import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { listAuditLogs } from "@/repositories/audit";

export const metadata: Metadata = { title: "Auditoria" };

export default async function AuditoriaPage() {
  await requireRole(["admin"]);
  const logs = await listAuditLogs();

  return (
    <div>
      <h1 className="text-2xl font-semibold">Auditoria</h1>
      <p className="mt-1 text-sm text-admin-foreground/70">
        Últimas {logs.length} ações sensíveis registradas no sistema.
      </p>

      {logs.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-admin-border p-10 text-center text-admin-foreground/70">
          Nenhum registro de auditoria ainda.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-admin-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-admin-border text-left text-admin-foreground/60">
                <th className="px-4 py-3 font-medium">Quando</th>
                <th className="px-4 py-3 font-medium">Ação</th>
                <th className="px-4 py-3 font-medium">Ator</th>
                <th className="px-4 py-3 font-medium">Entidade</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-admin-border last:border-0">
                  <td className="px-4 py-3 text-admin-foreground/70">
                    {new Date(log.createdAt).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{log.action}</td>
                  <td className="px-4 py-3 text-admin-foreground/70">
                    {log.actorRole ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-admin-foreground/70">
                    {log.entityType
                      ? `${log.entityType}${log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ""}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
