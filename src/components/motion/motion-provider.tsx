"use client";

import { MotionConfig } from "framer-motion";
import { usePerfMode } from "@/hooks/use-perf-mode";

/**
 * O interruptor que faltava no modo leve.
 *
 * O bloco `data-perf="lite"` do `globals.css` zera `animation-duration` e
 * `transition-duration` — e isso cobre tudo que anima por folha de estilo. Só
 * que o painel anima quase tudo por JavaScript: são 88 arquivos com Framer
 * Motion escrevendo `transform`/`opacity` inline, quadro a quadro, por fora do
 * CSS. Em outras palavras, o aparelho fraco que o modo leve existe para
 * socorrer continuava pagando a conta inteira das animações.
 *
 * `MotionConfig` é o único ponto onde isso se resolve de uma vez: ele desce
 * por contexto para TODO `motion.*` da subárvore, sem tocar em componente
 * nenhum. Com `reducedMotion="always"` o Framer para de interpolar
 * `transform` e `layout` e salta direto para o estado final — o conteúdo
 * aparece no lugar certo, na hora, e o que sobra é o fade de opacidade, que é
 * barato e ainda dá a noção de que algo entrou.
 *
 * Fora do modo leve o valor é `"user"`: quem pediu menos movimento no sistema
 * operacional passa a ser respeitado por padrão, em vez de depender de cada
 * componente lembrar de chamar `useReducedMotion()` (77 lembram; os outros
 * não).
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const { lite } = usePerfMode();

  return <MotionConfig reducedMotion={lite ? "always" : "user"}>{children}</MotionConfig>;
}
