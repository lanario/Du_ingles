import { LoadingVeil } from "@/components/ui/logo-loader";

/** O convite carrega dentro do card do layout — véu claro, sem esqueleto. */
export default function ConviteLoading() {
  return (
    <div className="relative min-h-[22rem] w-full">
      <LoadingVeil label="Carregando convite…" />
    </div>
  );
}
