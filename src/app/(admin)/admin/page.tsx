import type { Metadata } from "next";

export const metadata: Metadata = { title: "Visão geral" };

export default function AdminHomePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Visão geral</h1>
      <p className="mt-2 text-admin-foreground/70">
        Fase 1 concluída — gestão de usuários e o modo &quot;Ver como Professor&quot;
        chegam na Fase 3.
      </p>
    </div>
  );
}
