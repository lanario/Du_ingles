import type { Metadata } from "next";
import { AuthCard } from "@/components/features/auth/auth-card";
import { SetNewPasswordForm } from "@/components/features/auth/set-new-password-form";

export const metadata: Metadata = { title: "Definir senha" };

export default function DefinirSenhaPage() {
  return (
    <AuthCard>
      <SetNewPasswordForm heading="Este é o seu primeiro acesso. Defina uma nova senha para continuar." />
    </AuthCard>
  );
}
