import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-start justify-center gap-4 px-6 py-16">
      <h1 className="text-xl font-semibold">Página não encontrada</h1>
      <p className="text-sm opacity-70">
        O endereço não existe ou o conteúdo foi removido.
      </p>
      <Link
        href="/"
        className="inline-flex h-10 items-center rounded-xl bg-navy-900 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        Voltar ao início
      </Link>
    </main>
  );
}
