import type { Metadata } from "next";
import { AuthCard } from "@/components/features/auth/auth-card";
import { RequestResetForm } from "@/components/features/auth/request-reset-form";
import { FormBanner } from "@/components/ui/form-message";

export const metadata: Metadata = { title: "Recuperar senha" };

export default async function RecuperarSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthCard>
      <h1 className="mb-1 text-center text-xl font-semibold">Recuperar senha</h1>
      <p className="mb-5 text-center text-sm text-muted-foreground">
        Enviamos um link de redefinição para o seu e-mail.
      </p>
      {error === "invalid_link" && (
        <div className="mb-4">
          <FormBanner tone="error">
            Esse link expirou ou já foi usado. Solicite um novo abaixo.
          </FormBanner>
        </div>
      )}
      <RequestResetForm />
    </AuthCard>
  );
}
