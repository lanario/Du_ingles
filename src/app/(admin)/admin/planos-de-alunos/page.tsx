import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Planos de alunos" };

export default async function PlanosDeAlunosPage() {
  await requireRole(["admin"]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Planos de alunos</h1>
      <p className="mt-1 text-sm text-admin-foreground/70">
        Planos e pacotes contratados pelos alunos.
      </p>

      <p className="mt-10 rounded-lg border border-dashed border-admin-border p-10 text-center text-admin-foreground/70">
        Esta página está em construção.
      </p>
    </div>
  );
}
