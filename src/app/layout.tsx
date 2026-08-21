import type { Metadata } from "next";
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
      className={`${geistSans.variable} ${geistMono.variable} h-full scroll-smooth scroll-pt-24 antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
