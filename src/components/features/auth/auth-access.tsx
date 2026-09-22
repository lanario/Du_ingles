"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AuthSwitch, type AuthMode } from "@/components/ui/auth-switch";
import { LoginForm } from "@/components/features/auth/login-form";
import { RequestResetForm } from "@/components/features/auth/request-reset-form";
import { SignUpPanel } from "@/components/features/auth/signup-panel";

/** Tela de acesso e início do autocadastro do Du Inglês. */

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
              description: "Use o e-mail e a senha da sua conta.",
              content: <LoginForm onForgotPassword={() => setRecovering(true)} />,
            },
        cadastrar: {
          title: "Cadastre-se",
          description: "Conte sobre você, escolha um plano e crie seu acesso.",
          content: <SignUpPanel />,
        },
      }}
      prompts={{
        entrar: {
          heading: "Novo por aqui?",
          text: "Crie sua conta, escolha um plano e tenha 7 dias de experiência antes da primeira cobrança.",
          action: "Cadastre-se",
        },
        cadastrar: {
          heading: "Já é aluno?",
          text: "Entre com seu e-mail para ver suas aulas, tarefas e progresso.",
          action: "Entrar",
        },
      }}
    />
  );
}
