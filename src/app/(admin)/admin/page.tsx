import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { getAdminDashboard } from "@/repositories/dashboard";
import { getFinanceOverview } from "@/repositories/finance";
import { getOrganizationName } from "@/lib/organization";
import { AdminDashboardView } from "@/components/features/admin/dashboard/dashboard-view";

export const metadata: Metadata = { title: "Painel da escola" };

/**
 * O painel cruza a organização inteira, então nada aqui pode ser cacheado
 * entre requisições — o número de alunos ativos precisa refletir a matrícula
 * feita há trinta segundos.
 */
export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const ctx = await requireRole(["admin"]);
  const [data, finance, organizationName] = await Promise.all([
    getAdminDashboard(ctx.organizationId),
    getFinanceOverview(ctx.organizationId),
    getOrganizationName(ctx.organizationId),
  ]);

  return (
    <AdminDashboardView
      data={data}
      finance={finance}
      organizationName={organizationName}
    />
  );
}
