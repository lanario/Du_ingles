import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

const LINKS = [
  { href: "#metodologia", label: "Metodologia" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#professores", label: "Professores" },
  { href: "#planos", label: "Planos" },
  { href: "#faq", label: "FAQ" },
];

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Pular para o conteúdo
      </a>
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Du Inglês
        </Link>
        <ul className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="transition-colors hover:text-foreground">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <Link href="/login" className="text-sm text-muted-foreground hover:underline">
            Já sou aluno
          </Link>
          <a href="#contato" className={buttonVariants("primary")}>
            Aula experimental
          </a>
        </div>
      </nav>
    </header>
  );
}
