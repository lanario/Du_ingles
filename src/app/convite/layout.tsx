/**
 * O convite é a única tela de fora do sistema que não é o login: quem chega
 * aqui veio do WhatsApp, quase sempre no celular, e ainda não tem conta.
 * Por isso um container próprio, mais largo que o card de `(auth)` — o
 * cadastro tem seis campos e um medidor de senha, e espremer isso em
 * `max-w-sm` empurraria tudo para baixo da dobra.
 */
export default function ConviteLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-admin-background px-4 py-8 sm:py-12">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <p className="text-xl font-semibold tracking-tight text-navy-900">Du Inglês</p>
          <p className="mt-1 text-sm text-muted-foreground">Plataforma de ensino</p>
        </div>
        <div className="rounded-2xl border border-border bg-background p-5 shadow-[var(--shadow-card)] sm:p-7">
          {children}
        </div>
      </div>
    </main>
  );
}
