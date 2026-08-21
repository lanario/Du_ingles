import { MarketingNav } from "@/components/features/marketing/nav";
import { MarketingFooter } from "@/components/features/marketing/footer";
import { CookieConsent } from "@/components/features/marketing/cookie-consent";
import { BackToTop } from "@/components/features/marketing/back-to-top";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MarketingNav />
      <main id="conteudo">{children}</main>
      <MarketingFooter />
      <BackToTop />
      <CookieConsent />
    </>
  );
}
