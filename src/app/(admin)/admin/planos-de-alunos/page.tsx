import type { Metadata } from "next";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth/session";
import { isStripeConfigured, isStripeLiveMode } from "@/lib/stripe/client";
import { getConnectAccount } from "@/repositories/stripe-connect";
import { ensureTierCatalog } from "@/lib/plans/ensure-tier-catalog";
import { getSubscriptionSummary } from "@/repositories/student-subscriptions";
import { PlansView } from "@/components/features/admin/plans/plans-view";
import { LoadingVeil } from "@/components/ui/logo-loader";

export const metadata: Metadata = { title: "Planos de alunos" };

/**
 * Catálogo comercial da escola.
 *
 * As três leituras vão em paralelo: o cartão do Connect, os indicadores e a
 * lista aparecem juntos ou não aparecem — encadear as queries só somaria
 * latência sem melhorar nada na tela.
 *
 * `ensureTierCatalog` no lugar de um simples `listStudentPlans`: a grade
 * padrão da escola é o produto que ela vende, não uma decisão a tomar toda
 * vez — abrir a tela já a encontra pronta.
 */
async function PlansPageContent() {
  const ctx = await requireRole(["admin"]);

  const [plans, account, summary] = await Promise.all([
    ensureTierCatalog(ctx.organizationId, ctx.userId),
    getConnectAccount(ctx.organizationId),
    getSubscriptionSummary(ctx.organizationId),
  ]);

  return (
    <PlansView
      plans={plans}
      account={account}
      summary={summary}
      stripeConfigured={isStripeConfigured()}
      stripeLiveMode={isStripeLiveMode()}
    />
  );
}

/**
 * `PlansView` lê `?connect=retorno` com `useSearchParams`, o que exige um
 * limite de Suspense acima dele — sem isto o build falha ao pré-renderizar
 * esta rota.
 */
export default function PlanosDeAlunosPage() {
  return (
    <Suspense fallback={<PlansSkeleton />}>
      <PlansPageContent />
    </Suspense>
  );
}

function PlansSkeleton() {
  return (
    <div className="relative pb-10" aria-busy>
      <div className="animate-pulse" aria-hidden>
        <div className="h-8 w-56 rounded-lg bg-admin-muted" />
        <div className="mt-3 h-4 w-96 max-w-full rounded bg-admin-muted" />
        <div className="mt-6 h-24 rounded-2xl bg-admin-muted" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-64 rounded-2xl bg-admin-muted" />
          ))}
        </div>
      </div>

      <LoadingVeil label="Carregando os planos…" />
    </div>
  );
}
