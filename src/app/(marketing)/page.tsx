import type { Metadata } from "next";
import { ShaderBackground } from "@/components/ui/shader-background";
import { Hero } from "@/components/features/marketing/hero";
import { Methodology } from "@/components/features/marketing/methodology";
import { Teachers } from "@/components/features/marketing/teachers";
import { CefrLevels } from "@/components/features/marketing/cefr-levels";
import { Pricing } from "@/components/features/marketing/pricing";
import { Faq } from "@/components/features/marketing/faq";
import { env } from "@/lib/env";

// A rota é renderizada por request (`force-dynamic` no layout raiz) porque o
// CSP com nonce exige isso — ver o comentário em `src/app/layout.tsx`. O que
// era `revalidate = 3600` aqui virou cache de dados dentro de
// `listPublicTeachers()`, então a lista de professores continua sendo lida do
// Supabase no máximo uma vez por hora (§7.3).

export const metadata: Metadata = {
  title: { absolute: "Du Inglês — Aulas de inglês ao vivo, do A1 ao C2" },
  description:
    "Escola de inglês com aulas 100% ao vivo, nivelamento pelo padrão CEFR e material de estudo gerado a cada aula. Agende sua aula experimental gratuita.",
  openGraph: {
    title: "Du Inglês — Aulas de inglês ao vivo, do A1 ao C2",
    description:
      "Aulas 100% ao vivo, progresso mensurável e professores certificados. Agende sua aula experimental.",
    url: env.NEXT_PUBLIC_SITE_URL,
    siteName: "Du Inglês",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Du Inglês — Aulas de inglês ao vivo, do A1 ao C2",
    description: "Aulas 100% ao vivo e progresso mensurável pelo padrão CEFR.",
  },
  alternates: { canonical: "/" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  name: "Du Inglês",
  url: env.NEXT_PUBLIC_SITE_URL,
  description: "Escola de inglês com aulas 100% ao vivo e nivelamento pelo padrão CEFR.",
  hasCourse: [{ "@type": "Course", name: "Inglês A1–C2 (CEFR)", courseCode: "A1-C2" }],
};

export default function MarketingHomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ShaderBackground />
      <Hero />
      <Methodology />
      <Teachers />
      <CefrLevels />
      <Pricing />
      <Faq />
    </>
  );
}
