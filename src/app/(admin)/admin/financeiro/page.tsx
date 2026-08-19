import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Financeiro" };

export default async function FinanceiroPage() {
  await requireRole(["admin"]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Financeiro</h1>
      <p className="mt-1 text-sm text-admin-foreground/70">
        Cobranças, pagamentos e faturamento da plataforma.
      </p>

      <p className="mt-10 rounded-lg border border-dashed border-admin-border p-10 text-center text-admin-foreground/70">
        Esta página está em construção.
      </p>
    </div>
  );
}
