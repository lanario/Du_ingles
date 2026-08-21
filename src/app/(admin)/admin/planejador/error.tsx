"use client";

import { useEffect } from "react";

/**
 * Limite de erro do planejador. Um erro de render numa navegação
 * client-side, sem isto, apaga a área de conteúdo e não diz nada — a tela
 * simplesmente fica branca até o próximo F5. Aqui ele vira uma mensagem com
 * o que aconteceu e um botão para tentar de novo sem recarregar a página.
 */
export default function PlanejadorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[planejador]", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 rounded-2xl border border-admin-border bg-admin-surface p-8">
      <div>
        <h1 className="text-lg font-semibold text-admin-foreground">
          Não consegui abrir esta tela
        </h1>
        <p className="mt-1 text-sm text-admin-foreground/60">
          O planejador falhou ao carregar. Tentar de novo costuma resolver; se
          persistir, o detalhe abaixo ajuda a investigar.
        </p>
      </div>

      <p className="w-full break-words rounded-xl border border-admin-border bg-admin-background px-3 py-2 font-mono text-xs text-admin-foreground/70">
        {error.message}
        {error.digest ? ` · ${error.digest}` : ""}
      </p>

      <button
        type="button"
        onClick={reset}
        className="inline-flex h-10 items-center rounded-xl bg-navy-900 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        Tentar de novo
      </button>
    </div>
  );
}
