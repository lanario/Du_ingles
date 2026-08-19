import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { listPublicPlans } from "@/repositories/student-plans";
import { getActiveSubscriptionFor } from "@/repositories/student-subscriptions";
import { PlansShowcase } from "@/components/features/plans/plans-showcase";

export const metadata: Metadata = { title: "Planos" };

/**
 * Vitrine do aluno.
 *
 * `searchParams` traz o desfecho do checkout (`?assinatura=confirmada`), mas
 * ele é só o que a tela *mostra* — quem grava a assinatura é o webhook. Por
 * isso a página não confirma nada com base neste parâmetro: um aluno que
 * digitasse a URL na mão veria a mensagem e nada mais.
 */
export default async function PlanosPage({
  searchParams,
}: {
  searchParams: Promise<{ assinatura?: string }>;
}) {
  const ctx = await requireRole(["student"]);
  const params = await searchParams;

  const [plans, subscription] = await Promise.all([
    listPublicPlans(ctx.organizationId),
    getActiveSubscriptionFor(ctx.userId),
  ]);

  const outcome =
    params.assinatura === "confirmada"
      ? "confirmada"
      : params.assinatura === "cancelada"
        ? "cancelada"
        : null;

  return (
    <PlansShowcase
      plans={plans}
      subscription={subscription}
      readOnly={ctx.isViewAs}
      outcome={outcome}
    />
  );
}
