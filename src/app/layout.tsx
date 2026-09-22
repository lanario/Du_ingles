import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { env } from "@/lib/env";
import { PERF_INIT_SCRIPT } from "@/lib/perf";
import { CookieConsent } from "@/components/features/consent/cookie-consent";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: {
    default: "Du Inglês",
    template: "%s | Du Inglês",
  },
  description:
    "Du Inglês — plataforma de gestão de ensino de inglês para alunos, professores e administradores.",
  robots: { index: true, follow: true },
};

/**
 * `viewport-fit=cover` é o que libera as variáveis `env(safe-area-inset-*)`
 * usadas pelo chrome mobile (cabeçalho, gaveta, barra de CTA e faixa de
 * cookies). Sem ele o iOS ignora os insets e o conteúdo fica escondido atrás
 * do notch e da barra inferior do Safari.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

/**
 * O CSP do middleware usa `nonce` + `strict-dynamic`, e o nonce é sorteado a
 * cada request. Uma página pré-renderizada tem o HTML congelado no build, sem
 * nonce nenhum nas tags `<script>` — o header chega com um nonce novo, o
 * `strict-dynamic` anula o `'self'`, e o browser bloqueia *todo* o JS da
 * página. Nonce por request só funciona com render por request: renderização
 * dinâmica aqui é requisito do CSP, não escolha de performance. O custo de
 * dados fica coberto pelo cache na camada de repositório (ver
 * `listPublicTeachers`).
 */
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // O CSP do middleware é `strict-dynamic` com nonce por request: sem repetir
  // o nonce aqui, o browser recusa o script inline.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="pt-BR"
      // `scroll-pt` acompanha a altura do cabeçalho fixo (h-16 até `lg`,
      // h-24 a partir dali): sem isso a âncora para com o título da seção
      // escondido atrás dele.
      className={`${geistSans.variable} ${geistMono.variable} h-full scroll-smooth scroll-pt-20 antialiased lg:scroll-pt-28`}
      // O script inline abaixo escreve `data-perf` no <html> antes da
      // hidratação, então o servidor nunca manda o mesmo atributo.
      suppressHydrationWarning
    >
      <head>
        {/* O browser apaga o atributo `nonce` do DOM depois de validá-lo (ele
            só sobrevive como propriedade), então o cliente sempre vê algo
            diferente do que o servidor mandou. É um mismatch inevitável e sem
            consequência — `suppressHydrationWarning` precisa estar na própria
            tag, porque a do <html> não alcança os netos. */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: PERF_INIT_SCRIPT }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
