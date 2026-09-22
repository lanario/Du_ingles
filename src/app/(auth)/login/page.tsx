import type { Metadata } from "next";
import { AuthAccess } from "@/components/features/auth/auth-access";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ cadastro?: string }>;
}) {
  const params = await searchParams;
  return (
    <>
      {/* O alternador já rotula os dois painéis na tela; o h1 existe para dar
          título à página em leitores de tela. */}
      <h1 className="sr-only">Entrar no Du Inglês</h1>
      {params.cadastro === "feito" && (
        <p
          role="status"
          className="mb-4 max-w-xl rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white"
        >
          Sua conta foi criada. Entre com o e-mail e a senha que você escolheu para
          continuar.
        </p>
      )}
      <AuthAccess />
    </>
  );
}
