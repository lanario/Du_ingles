import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Acesso negado" };

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-2xl font-bold">403 — Acesso negado</h1>
      <p className="max-w-md text-muted-foreground">
        Você não tem permissão para acessar esta página.
      </p>
      <Link href="/dashboard" className="text-primary hover:underline">
        Voltar ao painel
      </Link>
    </main>
  );
}
