"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";

/**
 * Aquece QUALQUER link interno no primeiro sinal de intenção.
 *
 * O `NavLink` (`components/ui/nav-link.tsx`) já fazia isso, mas só alcança as
 * quatro barras de navegação. O resto do painel navega por links comuns —
 * cartão de turma, linha de aluno, item de tarefa, "voltar", paginação: são 52
 * `<Link>` contra 4 `<NavLink>`. Para rota dinâmica (e aqui TODA rota é
 * dinâmica, por causa do nonce do CSP), o `prefetch` padrão do Next busca só a
 * casca do `loading.tsx`. Ou seja: o caminho mais percorrido do sistema — abrir
 * um registro a partir de uma lista — era justamente o que nunca vinha
 * adiantado, e o clique ficava esperando o servidor renderizar a tela inteira.
 *
 * Em vez de trocar 52 chamadas de import (e depender de alguém lembrar na
 * próxima tela), o aquecimento passa a ser do documento: um punhado de
 * listeners na fase de captura encontra o `<a>` mais próximo do alvo e manda
 * `router.prefetch`. Link novo entra coberto no dia em que nasce.
 *
 * Os gatilhos são os ~100–300 ms entre a intenção e o clique:
 *
 *   - `pointerover` com carência de 60 ms — o cursor pousou no link, em vez de
 *     ter passado por cima dele a caminho de outro;
 *   - `pointerdown` e `touchstart` — o dedo/botão encostou, sem carência: é a
 *     última janela antes do clique, e no celular é a única;
 *   - `focusin` — chegou por teclado.
 *
 * Três cuidados:
 *
 *   - **Dedupe com validade.** O mesmo href não é pedido duas vezes dentro da
 *     janela do `staleTimes` do `next.config.ts` — passar disso o payload já
 *     teria sido descartado do cache do roteador, e aí vale pedir de novo.
 *   - **Economia de dados.** Quem ligou `saveData` no navegador pediu para não
 *     gastar rede com o que talvez não use; aqui isso é respeitado.
 *   - **Só o que é nosso.** Origem diferente, `target`, `download`, âncora na
 *     mesma página e `data-no-prefetch` ficam de fora.
 *
 * Vale lembrar ao medir: o próprio Next desliga TODO prefetch em
 * desenvolvimento (`createPrefetchURL` devolve `null` quando
 * `NODE_ENV === "development"`, para não recompilar rota que ninguém abriu).
 * A diferença que este arquivo faz só aparece em `next build && next start` —
 * em `next dev` a navegação continua esperando o servidor, como antes.
 */

/** Espelha `experimental.staleTimes.dynamic` do `next.config.ts`, em ms. */
const STALE_MS = 120_000;

/**
 * Carência do `pointerover`: abaixo disso o cursor só passou por cima. Não
 * vale para toque, botão pressionado nem teclado — nesses o clique já vem.
 */
const HOVER_DWELL_MS = 60;

function prefetchableHref(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  const anchor = target.closest("a");
  if (!anchor) return null;

  if (anchor.target && anchor.target !== "_self") return null;
  if (anchor.hasAttribute("download")) return null;
  if (anchor.dataset.noPrefetch !== undefined) return null;
  if (anchor.getAttribute("aria-disabled") === "true") return null;

  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#")) return null;

  // `anchor.href` já resolve relativo; comparar origem é o que separa a rota
  // do app de um link para fora (Stripe, docs, e-mail).
  let url: URL;
  try {
    url = new URL(anchor.href);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  // A própria página em que já estamos não precisa ser buscada.
  if (url.pathname + url.search === window.location.pathname + window.location.search) {
    return null;
  }

  return url.pathname + url.search;
}

export function LinkPrefetcher() {
  const router = useRouter();

  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection;
    if (connection?.saveData) return;

    /** href -> instante do último pedido. */
    const warmed = new Map<string, number>();
    let hoverTimer: ReturnType<typeof setTimeout> | null = null;

    function warm(href: string) {
      const now = Date.now();
      const last = warmed.get(href);
      if (last !== undefined && now - last < STALE_MS) return;
      warmed.set(href, now);
      // Sem segundo argumento o `prefetch` do roteador já assume
      // `PrefetchKind.FULL` (`client/components/app-router-instance.js`), que é
      // a rota inteira — e não a casca do `loading`, que é o que o
      // `<Link>` sem `prefetch` traz para rota dinâmica. O `as Route` é a
      // ponte entre o href que só existe em runtime e o `typedRoutes` do
      // `next.config.ts`; quem valida que a rota existe é o `<Link>` que
      // desenhou esse href.
      router.prefetch(href as Route);
    }

    function onIntent(event: Event) {
      const href = prefetchableHref(event.target);
      if (href) warm(href);
    }

    function onHover(event: Event) {
      if (hoverTimer) clearTimeout(hoverTimer);
      const href = prefetchableHref(event.target);
      if (!href) return;
      hoverTimer = setTimeout(() => warm(href), HOVER_DWELL_MS);
    }

    // Captura: alguns cartões chamam `stopPropagation` no clique/hover para
    // controlar o próprio realce, e na fase de borbulha o evento não chegaria.
    const opts = { capture: true, passive: true } as const;
    document.addEventListener("pointerover", onHover, opts);
    document.addEventListener("pointerdown", onIntent, opts);
    document.addEventListener("touchstart", onIntent, opts);
    document.addEventListener("focusin", onIntent, opts);

    return () => {
      if (hoverTimer) clearTimeout(hoverTimer);
      document.removeEventListener("pointerover", onHover, opts);
      document.removeEventListener("pointerdown", onIntent, opts);
      document.removeEventListener("touchstart", onIntent, opts);
      document.removeEventListener("focusin", onIntent, opts);
    };
  }, [router]);

  return null;
}
