import Link from "next/link";
import { ArrowLeftIcon } from "@/components/ui/icons";

/**
 * Moldura das telas de auth: o navy institucional saiu da coluna da esquerda e
 * virou o fundo da página — quem carrega o navy agora é o próprio card de
 * acesso, na face que desliza (§8.1). Sem isso seriam dois blocos navy
 * disputando a mesma tela.
 *
 * O layout traz a saída e centraliza o resto: cada rota entrega o seu card
 * (`AuthSwitch` no login, `AuthCard` nas telas de senha).
 *
 * A volta para o site fica numa faixa própria acima do card, e não flutuando
 * sobre ele: no celular o card ocupa quase toda a largura, e um botão
 * absoluto cairia por cima do formulário.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col bg-[linear-gradient(135deg,var(--navy-800)_0%,var(--navy-950)_100%)] p-4 sm:p-6 lg:p-10">
      <div>
        <Link
          href="/"
          className="inline-flex h-9 items-center gap-2 rounded-full border border-white/25 bg-white/5 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-app-shell-foreground/85 transition-colors hover:border-accent hover:bg-white/10 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        >
          <ArrowLeftIcon className="size-4" />
          Voltar ao site
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center py-6">{children}</div>
    </main>
  );
}
