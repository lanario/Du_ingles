import { MarketingNav } from "@/components/features/marketing/nav";
import { MarketingFooter } from "@/components/features/marketing/footer";
import { CookieConsent } from "@/components/features/marketing/cookie-consent";
import { BackToTop } from "@/components/features/marketing/back-to-top";
import { MobileCtaBar } from "@/components/features/marketing/mobile-cta-bar";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MarketingNav />
      <main id="conteudo">{children}</main>
      {/* Espaço para a barra de CTA fixa não cobrir o fim do rodapé. */}
      <div className="pb-[var(--mobile-cta-height)] md:pb-0">
        <MarketingFooter />
      </div>
      <BackToTop />
      <MobileCtaBar />
      <CookieConsent />
    </>
  );
}
