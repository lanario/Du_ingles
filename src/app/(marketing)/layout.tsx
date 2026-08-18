import { MarketingNav } from "@/components/features/marketing/nav";
import { MarketingFooter } from "@/components/features/marketing/footer";
import { CookieConsent } from "@/components/features/marketing/cookie-consent";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MarketingNav />
      <main id="conteudo">{children}</main>
      <MarketingFooter />
      <CookieConsent />
    </>
  );
}
