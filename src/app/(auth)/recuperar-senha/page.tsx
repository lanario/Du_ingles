import type { Metadata } from "next";
import { AuthCard } from "@/components/features/auth/auth-card";
import { RequestResetForm } from "@/components/features/auth/request-reset-form";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function RecuperarSenhaPage() {
  return (
    <AuthCard>
      <h1 className="mb-1 text-center text-xl font-semibold">Recuperar senha</h1>
      <p className="mb-5 text-center text-sm text-muted-foreground">
        Enviamos um link de redefinição para o seu e-mail.
      </p>
      <RequestResetForm />
    </AuthCard>
  );
}
