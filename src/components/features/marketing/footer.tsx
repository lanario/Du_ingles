import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer>
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className="text-lg font-bold">Du Inglês</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Escola de inglês com aulas 100% ao vivo e progresso mensurável.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold">Contato</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>contato@duingles.com.br</li>
              <li>(11) 0000-0000</li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold">Institucional</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>
                <Link href="/privacidade" className="hover:underline">
                  Política de privacidade
                </Link>
              </li>
              <li>
                <Link href="/termos" className="hover:underline">
                  Termos de uso
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Du Inglês. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
