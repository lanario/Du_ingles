import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  await requireRole(["admin"]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Configurações</h1>
      <p className="mt-1 text-sm text-admin-foreground/70">
        Preferências e configurações gerais da plataforma.
      </p>

      <p className="mt-10 rounded-lg border border-dashed border-admin-border p-10 text-center text-admin-foreground/70">
        Esta página está em construção.
      </p>
    </div>
  );
}
