import type { Metadata } from "next";
import { AuthAccess } from "@/components/features/auth/auth-access";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <>
      {/* O alternador já rotula os dois painéis na tela; o h1 existe para dar
          título à página em leitores de tela. */}
      <h1 className="sr-only">Entrar no Du Inglês</h1>
      <AuthAccess />
    </>
  );
}
