import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage() {
  await requireRole(["admin"]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Agenda</h1>
      <p className="mt-1 text-sm text-admin-foreground/70">
        Compromissos e horários da plataforma.
      </p>

      <p className="mt-10 rounded-lg border border-dashed border-admin-border p-10 text-center text-admin-foreground/70">
        Esta página está em construção.
      </p>
    </div>
  );
}
