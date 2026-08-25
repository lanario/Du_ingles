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
     * Com 30s, o clique reaproveita o que já está em memória e a troca de tela
     * vira instantânea; o que o próprio usuário altera continua fresco, porque
     * `revalidatePath` nas server actions invalida este cache junto.
     */
    staleTimes: { dynamic: 30, static: 180 },

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
