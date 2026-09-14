"use client";

import { useEffect, useState } from "react";

/**
 * O modo leve está ligado? (ver `lib/perf.ts`)
 *
 * O CSS resolve blur, sombra e transição sozinho. Este hook serve para o que
 * só o JavaScript consegue cortar: canvas WebGL que nem deveria ser montado,
 * `requestAnimationFrame` que gira sem parar, biblioteca pesada que não
 * precisa ser baixada.
 *
 * Começa em `false` de propósito. No primeiro render do cliente o React tem de
 * casar com o HTML do servidor, que não conhece o aparelho de ninguém; o valor
 * real entra logo depois, no efeito. Como o modo leve só REMOVE enfeite, a
 * troca não mexe em layout — nada salta na tela.
 */
export function usePerfMode(): { lite: boolean } {
  const [lite, setLite] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setLite(root.getAttribute("data-perf") === "lite");
    sync();

    // O atributo muda quando o usuário troca a preferência à mão.
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-perf"] });
    return () => observer.disconnect();
  }, []);

  return { lite };
}
