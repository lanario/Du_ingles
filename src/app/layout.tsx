import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { env } from "@/lib/env";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      // `scroll-pt` acompanha a altura do cabeçalho fixo (h-16 até `lg`,
      // h-24 a partir dali): sem isso a âncora para com o título da seção
      // escondido atrás dele.
      className={`${geistSans.variable} ${geistMono.variable} h-full scroll-smooth scroll-pt-20 antialiased lg:scroll-pt-28`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
