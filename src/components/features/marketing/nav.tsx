import Link from "next/link";
import Image from "next/image";
import { LettersLink } from "@/components/ui/letters-link";
import { SlideTabs, type SlideTabItem } from "@/components/ui/slide-tabs";

const LINKS: SlideTabItem[] = [
  { href: "#metodologia", label: "Metodologia" },
  { href: "#niveis", label: "Turmas" },
  { href: "#professores", label: "Professores" },
  { href: "#planos", label: "Planos" },
  { href: "#faq", label: "FAQ" },
];

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 bg-transparent">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Pular para o conteúdo
      </a>
      <nav className="mx-auto flex h-24 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center" aria-label="Du Inglês">
          <Image
            src="/du_ingles_logo.svg"
            alt="Du Inglês"
            width={72}
            height={72}
            priority
            className="h-[4.5rem] w-auto"
          />
        </Link>
        <SlideTabs
          items={LINKS}
          label="Seções da página"
          className="hidden md:inline-flex"
        />
        <div className="flex items-center gap-2">
          <LettersLink href="/login" label="Já sou aluno" />
        </div>
      </nav>
    </header>
  );
}
