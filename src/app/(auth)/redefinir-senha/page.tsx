import type { Metadata } from "next";
import { SetNewPasswordForm } from "@/components/features/auth/set-new-password-form";

export const metadata: Metadata = { title: "Redefinir senha" };

export default function RedefinirSenhaPage() {
  return <SetNewPasswordForm heading="Escolha uma nova senha para a sua conta." />;
}
