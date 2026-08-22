"use client";

import Link from "next/link";

/**
 * Face "Cadastre-se". Não é um formulário de cadastro: no Du Inglês a conta
 * nasce de um convite emitido depois da matrícula (`/convite/[token]`), então
 * o que essa face faz é mostrar o caminho até ele — e levar ao único passo que
 * o visitante pode dar sozinho, a aula experimental da landing.
 */

const STEPS = [
  {
    title: "Agende a aula experimental",
    detail: "Gratuita, com professor ao vivo.",
  },
  {
    title: "Faça o nivelamento CEFR",
    detail: "Definimos seu nível de A1 a C2 e a turma certa.",
  },
  {
    title: "Receba o convite por e-mail",
    detail: "É por ele que você cria sua senha.",
  },
];

export function SignUpPanel() {
  return (
    <div className="space-y-5">
      <ol className="space-y-3 text-left">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span
              aria-hidden
              className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-primary"
            >
              {index + 1}
            </span>
            <div>
              <p className="text-sm font-medium leading-snug">{step.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {step.detail}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {/* O formulário da aula experimental vive na seção `#faq` da landing. */}
      <Link
        href={{ pathname: "/", hash: "faq" }}
        className="btn-cta-fill h-12 w-full text-sm uppercase tracking-wide"
      >
        Agendar aula experimental
      </Link>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Já recebeu um convite? Abra o link enviado para o seu e-mail — é ele que ativa a
        conta.
      </p>
    </div>
  );
}
