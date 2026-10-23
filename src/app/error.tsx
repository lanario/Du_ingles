"use client";

import { useEffect } from "react";

/** Limite de erro da raiz: qualquer página sem `error.tsx` próprio cai aqui. */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app]", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-start justify-center gap-4 px-6 py-16">
      <h1 className="text-xl font-semibold">Algo deu errado</h1>
      <p className="text-sm opacity-70">
        Não foi possível carregar esta página. Tente de novo; se persistir, avise a
        coordenação{error.digest ? ` informando o código ${error.digest}` : ""}.
      </p>
      <button
        type="button"
        onClick={reset}
        className="inline-flex h-10 items-center rounded-xl bg-navy-900 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        Tentar de novo
      </button>
    </main>
  );
}
