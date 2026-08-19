import type { Metadata } from "next";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth/session";
import { isStripeConfigured, isStripeLiveMode } from "@/lib/stripe/client";
import { getConnectAccount } from "@/repositories/stripe-connect";
import { listStudentPlans } from "@/repositories/student-plans";
import { getSubscriptionSummary } from "@/repositories/student-subscriptions";
import { PlansView } from "@/components/features/admin/plans/plans-view";

export const metadata: Metadata = { title: "Planos de alunos" };

/**
 * Catálogo comercial da escola.
 *
 * As três leituras vão em paralelo: o cartão do Connect, os indicadores e a
 * lista aparecem juntos ou não aparecem — encadear as queries só somaria
 * latência sem melhorar nada na tela.
 */
async function PlansPageContent() {
  const ctx = await requireRole(["admin"]);

  const [plans, account, summary] = await Promise.all([
    listStudentPlans(ctx.organizationId),
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
    <div className="animate-pulse pb-10">
      <div className="h-8 w-56 rounded-lg bg-admin-muted" />
      <div className="mt-3 h-4 w-96 max-w-full rounded bg-admin-muted" />
      <div className="mt-6 h-24 rounded-2xl bg-admin-muted" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-64 rounded-2xl bg-admin-muted" />
        ))}
      </div>
    </div>
  );
}
