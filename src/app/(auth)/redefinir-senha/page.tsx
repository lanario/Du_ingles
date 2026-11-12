import type { Metadata } from "next";
import { AuthCard } from "@/components/features/auth/auth-card";
import { SetNewPasswordForm } from "@/components/features/auth/set-new-password-form";

export const metadata: Metadata = { title: "Redefinir senha" };

export default async function RedefinirSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const { token_hash, type } = await searchParams;
  return (
    <AuthCard>
      <SetNewPasswordForm
        heading="Escolha uma nova senha para a sua conta."
        tokenHash={token_hash}
        type={type}
      />
    </AuthCard>
  );
}
