import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { listLessonPlans } from "@/repositories/lesson-plans";

export const metadata: Metadata = { title: "Planos de aula" };

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function PlanosDeAulaPage({ searchParams }: PageProps) {
  const ctx = await requireRole(["teacher"]);
  const { q } = await searchParams;
  const plans = await listLessonPlans(ctx.userId, q);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Planos de aula</h1>
        <Link
          href="/planos-de-aula/novo"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Novo plano
        </Link>
      </div>

      <form className="mt-6" action="/planos-de-aula">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por título ou resumo…"
          className="h-10 w-full max-w-sm rounded-md border border-border bg-background px-3 text-sm"
        />
      </form>

      {plans.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          {q
            ? "Nenhum plano encontrado para essa busca."
            : "Nenhum plano de aula criado ainda."}
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <li key={plan.id} className="rounded-lg border border-border p-4">
              <Link
                href={`/planos-de-aula/${plan.id}`}
                className="font-medium hover:underline"
              >
                {plan.title}
              </Link>
              {plan.summary && (
                <p className="mt-1 text-sm text-muted-foreground">{plan.summary}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-muted px-2 py-0.5">{plan.level}</span>
                <span>{plan.durationMinutes} min</span>
                {!plan.isOwn && <span>· de {plan.authorName}</span>}
                {plan.isShared && <span className="text-primary">· compartilhado</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
