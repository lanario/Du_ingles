import type { Metadata } from "next";
import { AuthCard } from "@/components/features/auth/auth-card";
import { SetNewPasswordForm } from "@/components/features/auth/set-new-password-form";

export const metadata: Metadata = { title: "Redefinir senha" };

export default function RedefinirSenhaPage() {
  return (
    <AuthCard>
      <SetNewPasswordForm heading="Escolha uma nova senha para a sua conta." />
    </AuthCard>
  );
}
