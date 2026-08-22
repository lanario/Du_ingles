"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AuthSwitch, type AuthMode } from "@/components/ui/auth-switch";
import { LoginForm } from "@/components/features/auth/login-form";
import { RequestResetForm } from "@/components/features/auth/request-reset-form";
import { SignUpPanel } from "@/components/features/auth/signup-panel";

/**
 * Tela de acesso do Du Inglês nas duas faces do `AuthSwitch`.
 *
 * "Cadastre-se" não abre formulário: não existe cadastro público — a conta
 * nasce de um convite emitido depois da matrícula —, então a face mostra o
 * caminho real até ela em vez de criar um usuário sem turma e sem plano.
 *
 * Recuperar senha não é uma terceira face: é um desvio do login. O "Esqueceu a
 * senha?" troca o conteúdo da face "entrar" no lugar, sem recarregar a página
 * e sem mexer no navy; a rota `/recuperar-senha` continua existindo para quem
 * chega por link direto.
 */

const HIGHLIGHTS = [
  { value: "100%", label: "das aulas ao vivo" },
  { value: "A1–C2", label: "nivelamento CEFR" },
  { value: "500+", label: "alunos ativos" },
];

export function AuthAccess() {
  const [mode, setMode] = useState<AuthMode>("entrar");
  const [recovering, setRecovering] = useState(false);

  const selectMode = (next: AuthMode) => {
    setMode(next);
    // Voltar para "Entrar" cai sempre no login, e não na recuperação que tinha
    // ficado aberta antes da troca de face.
    if (next === "entrar") setRecovering(false);
  };

  // A marca troca de arte com a superfície: dourada sobre o navy do painel,
  // colorida sobre o branco do card empilhado.
  const brand = (
    <Link href="/" className="inline-flex" aria-label="Du Inglês">
      <Image
        src="/logo_amarela.svg"
        alt="Du Inglês"
        width={72}
        height={72}
        priority
        className="hidden h-14 w-auto lg:block"
      />
      <Image
        src="/du_ingles_logo.svg"
        alt="Du Inglês"
        width={64}
        height={64}
        priority
        className="h-12 w-auto lg:hidden"
      />
    </Link>
  );

  return (
    <AuthSwitch
      mode={mode}
      onModeChange={selectMode}
      brand={brand}
      highlights={HIGHLIGHTS}
      contentKey={mode === "entrar" && recovering ? "recuperar" : mode}
      faces={{
        entrar: recovering
          ? {
              title: "Recuperar senha",
              description: "Enviamos um link de redefinição para o seu e-mail.",
              content: <RequestResetForm onBack={() => setRecovering(false)} />,
            }
          : {
              title: "Entrar",
              description: "Use o e-mail cadastrado na sua matrícula.",
              content: <LoginForm onForgotPassword={() => setRecovering(true)} />,
            },
        cadastrar: {
          title: "Cadastre-se",
          description:
            "A conta nasce do convite que enviamos depois da aula experimental.",
          content: <SignUpPanel />,
        },
      }}
      prompts={{
        entrar: {
          heading: "Novo por aqui?",
          text: "A matrícula começa por uma aula experimental gratuita, com professor ao vivo.",
          action: "Cadastre-se",
        },
        cadastrar: {
          heading: "Já é aluno?",
          text: "Entre com o e-mail da matrícula para ver suas aulas, tarefas e progresso.",
          action: "Entrar",
        },
      }}
    />
  );
}
