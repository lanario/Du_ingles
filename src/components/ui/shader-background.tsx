"use client";

import { useEffect, useState } from "react";
import { MeshGradient } from "@paper-design/shaders-react";
import { cn } from "@/lib/utils";

/**
 * Fundo animado (mesh gradient em WebGL) na paleta branco + dourado do
 * sistema. É puramente decorativo: fica atrás do conteúdo, não recebe
 * ponteiro e nunca envolve o LCP — quem chama mantém a headline no HTML
 * do servidor (§7.2).
 *
 * `fixed` (padrão) cobre a viewport inteira e acompanha a rolagem, servindo
 * a página toda a partir de uma única instância; `fixed={false}` limita o
 * efeito à seção que o contém (precisa de `relative` no pai).
 *
 * Sobre o canvas WebGL há um degradê CSS estático que serve de fallback:
 * ele já pinta a área no primeiro frame (e permanece se o WebGL falhar ou
 * o usuário pedir menos movimento), então nunca existe um retângulo vazio.
 */

const GOLD_MESH = [
  "#ffffff",
  "#fdf8ec",
  "#f7edd2",
  "#e7cd8c",
  "#d9b45b",
  "#c9a227",
] as const;

const GOLD_WASH = ["#ffffff", "#f7edd2", "#d9b45b"] as const;

/** Teto de pixels do canvas — evita custo de retina em telas grandes. */
const MAX_PIXEL_COUNT = 1920 * 1080;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return reduced;
}

export function ShaderBackground({
  className,
  fixed = true,
}: {
  className?: string;
  fixed?: boolean;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [mounted, setMounted] = useState(false);

  // Só monta o canvas depois da hidratação: o degradê estático segura a
  // primeira pintura e o WebGL entra sem competir com o carregamento.
  useEffect(() => setMounted(true), []);

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none overflow-hidden",
        fixed ? "fixed inset-0 -z-10" : "absolute inset-0",
        className,
      )}
    >
      {/* Fallback estático — sempre visível, sob o canvas. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 12% 8%, #ffffff 0%, #fdf8ec 38%, #f7edd2 62%, #e7cd8c 100%)",
        }}
      />

      {mounted ? (
        <>
          <MeshGradient
            className="absolute inset-0 h-full w-full"
            colors={[...GOLD_MESH]}
            speed={reducedMotion ? 0 : 0.18}
            distortion={0.8}
            swirl={0.6}
            grainMixer={0.15}
            grainOverlay={0.03}
            maxPixelCount={MAX_PIXEL_COUNT}
          />
          <MeshGradient
            className="absolute inset-0 h-full w-full opacity-45 mix-blend-soft-light"
            colors={[...GOLD_WASH]}
            speed={reducedMotion ? 0 : 0.1}
            distortion={1}
            swirl={0.9}
            maxPixelCount={MAX_PIXEL_COUNT}
          />
        </>
      ) : null}

      {/* Véu branco: garante contraste AA do texto navy sobre o dourado. */}
      <div className="absolute inset-0 bg-white/55" />
    </div>
  );
}
