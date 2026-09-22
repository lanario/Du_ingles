"use client";

import Link from "next/link";

/** Porta de entrada do autocadastro; o formulário completo fica em /cadastro. */

export function SignUpPanel() {
  return (
    <div className="space-y-5">
      <Link
        href="/cadastro"
        className="btn-cta-fill h-12 w-full text-sm uppercase tracking-wide"
      >
        Começar cadastro
      </Link>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Preencha seus dados, escolha um plano e cadastre o pagamento com 7 dias de
        experiência antes da primeira cobrança.
      </p>
    </div>
  );
}
