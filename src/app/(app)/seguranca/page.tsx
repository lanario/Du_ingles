import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { PasswordForm } from "@/components/features/account/password-form";

export const metadata: Metadata = { title: "Segurança" };

export default async function SegurancaPage() {
  await requireRole(["teacher", "student"]);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-navy-900">Segurança</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Sua senha de acesso à plataforma.
      </p>

      <div className="mt-8 space-y-6">
        <PasswordForm />

        <p className="text-sm text-muted-foreground">
          Exportação e exclusão de dados pessoais ficam em{" "}
          <Link href="/meus-dados" className="font-medium text-navy-900 underline">
            Meus dados
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
