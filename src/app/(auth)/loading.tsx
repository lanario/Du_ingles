import { LoadingVeil } from "@/components/ui/logo-loader";

/**
 * As telas de acesso não têm esqueleto: o card é uma peça só, e uma silhueta
 * dele atrás do desfoque não diria nada que o véu já não diga. O fundo aqui é
 * o degradê navy do layout, então o véu escurece em vez de clarear.
 */
export default function AuthLoading() {
  return (
    <div className="relative min-h-[26rem] w-full max-w-sm">
      <LoadingVeil surface="dark" label="Carregando…" />
    </div>
  );
}
