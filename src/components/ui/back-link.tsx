"use client";

/**
 * "Voltar" que usa o histórico do navegador em vez de sempre mandar para uma
 * rota fixa. Um `Link` fixo faz quem estava numa aba, filtro ou aba de turma
 * específica cair no estado padrão da tela anterior ao sair de um detalhe —
 * o estado de onde a pessoa veio existe, só não é isso que o `Link` respeita.
 *
 * `fallbackHref` só entra em jogo quando não há entrada anterior no
 * histórico desta aba (ex.: a tela foi aberta direto por um link externo).
 *
 * `preferFallback` inverte a lógica: navega sempre para `fallbackHref` com um
 * `Link` (pré-carregado). É para telas cuja origem restaura o próprio estado
 * (ex.: o planejador, via localStorage) — `router.back()` depende do histórico,
 * que nessas telas acumula `replace`/refresh e faz o botão demorar ou não sair.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";

interface BackLinkProps {
  fallbackHref: Route;
  preferFallback?: boolean;
  className?: string;
  "aria-label"?: string;
  children?: ReactNode;
}

export function BackLink({
  fallbackHref,
  preferFallback,
  className,
  children,
  ...rest
}: BackLinkProps) {
  const router = useRouter();

  if (preferFallback) {
    return (
      <Link href={fallbackHref} prefetch className={className} {...rest}>
        {children}
      </Link>
    );
  }

  function handleClick() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button type="button" onClick={handleClick} className={className} {...rest}>
      {children}
    </button>
  );
}
