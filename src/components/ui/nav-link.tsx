"use client";

import Link from "next/link";
import { useState } from "react";

type LinkProps = React.ComponentProps<typeof Link>;

/**
 * Link de navegação que se aquece na intenção, não na aparição.
 *
 * Toda rota daqui é dinâmica (o CSP com nonce por request obriga — ver o
 * `layout.tsx` raiz), e para rota dinâmica o `prefetch` padrão do Next busca
 * só a casca do `loading.tsx`: o clique continua esperando o servidor render
 * a tela inteira. `prefetch` cravado em `true` resolveria a espera e criaria
 * outra: as vinte e poucas entradas do painel estão todas na viewport assim
 * que a barra monta, e cada uma dispararia um render completo no servidor —
 * multiplicado por usuário simultâneo, é justamente a conta que não fecha.
 *
 * O meio-termo é ligar o prefetch completo no primeiro sinal de que a pessoa
 * vai clicar: o ponteiro entrou no item, o foco chegou por teclado, ou o dedo
 * encostou. São os ~100–300ms entre a intenção e o clique — tempo de sobra
 * para o payload RSC chegar e o `staleTimes` do `next.config.ts` segurá-lo em
 * memória, de modo que o clique só troca a árvore já pronta.
 */
export function NavLink({ onMouseEnter, onFocus, onTouchStart, ...props }: LinkProps) {
  const [warm, setWarm] = useState(false);

  return (
    <Link
      {...props}
      // `undefined` (e não `false`) mantém o comportamento padrão enquanto
      // frio: a casca do `loading.tsx` continua vindo por antecipação, então
      // mesmo um clique sem hover — teclado rápido, toque direto — já pinta o
      // esqueleto de imediato.
      prefetch={warm ? true : undefined}
      onMouseEnter={(event) => {
        setWarm(true);
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        setWarm(true);
        onFocus?.(event);
      }}
      onTouchStart={(event) => {
        setWarm(true);
        onTouchStart?.(event);
      }}
    />
  );
}
