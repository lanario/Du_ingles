import type { NextConfig } from "next";

/**
 * Content-Security-Policy fica fora daqui: precisa de um nonce por request,
 * gerado em `middleware.ts`. Os headers abaixo são estáticos e cobrem toda
 * rota (`source: "/:path*"`).
 */
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  typedRoutes: true,
  // Fontes e logo do PDF são lidos com `fs` em tempo de execução — o tracer do Next
  // não os enxerga sozinho e eles ficariam de fora do bundle serverless.
  outputFileTracingIncludes: {
    "/**": ["./src/lib/pdf/fonts/**/*", "./src/lib/pdf/brand/**/*"],
  },
  experimental: {
    /**
     * Rede de segurança para o autosave de uma aula cujo upload de imagem
     * falhou: o documento carrega o `data:` URL da imagem até o próximo
     * envio bem-sucedido, e 1 MB (o padrão) derrubaria a gravação.
     */
    serverActions: { bodySizeLimit: "8mb" },

    /**
     * Cache do roteador no cliente. O padrão do Next 15 para rota dinâmica é
     * `0`: o payload RSC que o `prefetch` acabou de buscar é jogado fora no
     * instante do clique, e toda navegação — inclusive o "voltar" do browser
     * e o vai-e-volta entre duas telas do painel — refaz a viagem ao servidor.
     * Com a janela aberta, o clique reaproveita o que já está em memória e a
     * troca de tela vira instantânea.
     *
     * 120s, e não 30s: a janela também limita o prefetch por intenção
     * (`components/features/link-prefetcher.tsx`), que agora aquece todo link
     * do painel. Em 30s o payload recém-buscado expirava antes de a pessoa
     * terminar de ler a tela em que estava, e o "voltar" para a lista — a
     * navegação mais repetida do sistema — pagava o servidor de novo.
     *
     * O que impede o dado velho de aparecer não é a janela curta, são as duas
     * invalidações que já existem: `revalidatePath` nas server actions cobre o
     * que o próprio usuário altera, e `<LiveRefresh>` cobre o que os outros
     * alteram, via realtime. Se algum dia esses dois deixarem de cobrir uma
     * tela, é lá que se conserta — não encurtando isto aqui.
     */
    staleTimes: { dynamic: 120, static: 180 },

    /**
     * `optimizePackageImports` foi testado aqui e não entra: com
     * `framer-motion` na lista, o dev quebra a página pública inteira
     * (`__webpack_modules__[moduleId] is not a function` ao resolver
     * `marketing/hero.tsx`). `date-fns` o Next já otimiza sozinho — está na
     * lista padrão dele —, então não sobrava ganho para pagar o risco.
     */
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
