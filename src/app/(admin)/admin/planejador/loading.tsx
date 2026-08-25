import { LoadingVeil } from "@/components/ui/logo-loader";

/**
 * Esqueleto do planejador. Vale para esta rota e para as filhas (canvas e
 * sala de aula): sem ele, a navegação client-side fica com a área de
 * conteúdo vazia enquanto o servidor monta a página — e uma aula com muitas
 * imagens leva alguns instantes para chegar.
 *
 * O esqueleto continua aqui, e não no `PageLoader` genérico, porque a
 * silhueta desta tela é específica (quatro indicadores, depois a grade de
 * cards); por cima dele vem o véu com a marca.
 */
export default function PlanejadorLoading() {
  return (
    <div className="relative mx-auto max-w-[1400px] pb-16" aria-busy>
      <div className="animate-pulse" aria-hidden>
        <div className="h-3 w-40 rounded-full bg-admin-muted" />
        <div className="mt-3 h-8 w-80 rounded-lg bg-admin-muted" />
        <div className="mt-3 h-3 w-[28rem] max-w-full rounded-full bg-admin-muted" />

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className="h-[104px] rounded-2xl border border-admin-border bg-admin-surface"
            />
          ))}
        </div>

        <div className="mt-8 h-11 w-64 rounded-full bg-admin-muted" />

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div
              key={index}
              className="h-56 rounded-2xl border border-admin-border bg-admin-surface"
            />
          ))}
        </div>
      </div>

      <LoadingVeil label="Carregando o planejador…" />
    </div>
  );
}
