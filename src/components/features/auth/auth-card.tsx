import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Card das telas de auth de uma face só (definir, redefinir e recuperar senha
 * por link direto). O card de duas faces do login mora em `AuthSwitch`; aqui
 * basta a mesma superfície branca elevada sobre o navy da moldura.
 */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="w-full max-w-sm rounded-2xl bg-background p-6 shadow-[0_24px_60px_rgba(5,15,34,0.28)] sm:p-8">
      <Link
        href="/"
        className="mb-6 flex items-center justify-center"
        aria-label="Du Inglês"
      >
        <Image
          src="/du_ingles_logo.svg"
          alt="Du Inglês"
          width={64}
          height={64}
          priority
          className="h-14 w-auto"
        />
      </Link>
      {children}
    </div>
  );
}
