import Link from "next/link";

const EMAIL = "contato@duingles.com.br";
const PHONE_LABEL = "(11) 0000-0000";
const PHONE_HREF = "tel:+551100000000";

export function MarketingFooter() {
  return (
    <footer>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className="text-lg font-bold">Du Inglês</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Escola de inglês com aulas 100% ao vivo e progresso mensurável.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold">Contato</p>
            {/*
              No celular o rodapé é onde alguém tenta ligar ou escrever. Texto
              solto não faz nada num toque — daí `mailto:`/`tel:` e altura de
              linha suficiente para o alvo de 44px.
            */}
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>
                <a
                  href={`mailto:${EMAIL}`}
                  className="inline-flex min-h-11 items-center break-all hover:underline sm:min-h-0"
                >
                  {EMAIL}
                </a>
              </li>
              <li>
                <a
                  href={PHONE_HREF}
                  className="inline-flex min-h-11 items-center hover:underline sm:min-h-0"
                >
                  {PHONE_LABEL}
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold">Institucional</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>
                <Link
                  href="/privacidade"
                  className="inline-flex min-h-11 items-center hover:underline sm:min-h-0"
                >
                  Política de privacidade
                </Link>
              </li>
              <li>
                <Link
                  href="/termos"
                  className="inline-flex min-h-11 items-center hover:underline sm:min-h-0"
                >
                  Termos de uso
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-8 border-t border-border pt-6 text-xs text-muted-foreground sm:mt-10">
          © {new Date().getFullYear()} Du Inglês. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
