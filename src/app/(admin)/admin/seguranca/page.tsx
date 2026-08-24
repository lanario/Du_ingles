import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { PasswordForm } from "@/components/features/account/password-form";

export const metadata: Metadata = { title: "Segurança" };

export default async function AdminSegurancaPage() {
  await requireRole(["admin"]);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Segurança</h1>
      <p className="mt-1 text-sm text-admin-foreground/70">
        Sua senha de acesso ao painel.
      </p>

      <div className="mt-8 space-y-6">
        <PasswordForm theme="admin" />

        <p className="text-sm text-admin-foreground/70">
          Exportação e exclusão de dados pessoais ficam em{" "}
          <Link href="/admin/meus-dados" className="font-medium underline">
            Meus dados
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
