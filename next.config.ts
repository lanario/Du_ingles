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
