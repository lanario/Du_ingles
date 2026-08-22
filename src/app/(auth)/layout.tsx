/**
 * Moldura das telas de auth: o navy institucional saiu da coluna da esquerda e
 * virou o fundo da página — quem carrega o navy agora é o próprio card de
 * acesso, na face que desliza (§8.1). Sem isso seriam dois blocos navy
 * disputando a mesma tela.
 *
 * O layout só centraliza: cada rota traz o seu card (`AuthSwitch` no login,
 * `AuthCard` nas telas de senha).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,var(--navy-800)_0%,var(--navy-950)_100%)] p-4 sm:p-6 lg:p-10">
      {children}
    </main>
  );
}
