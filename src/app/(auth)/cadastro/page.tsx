import type { Metadata } from "next";
import { StudentRegistrationWizard } from "@/components/features/auth/student-registration-wizard";
import { getDefaultOrganizationId } from "@/lib/organization";
import { listPublicPlans } from "@/repositories/student-plans";

export const metadata: Metadata = { title: "Cadastro de aluno" };

export default async function CadastroPage() {
  const organizationId = await getDefaultOrganizationId();
  const plans = await listPublicPlans(organizationId);

  // Só planos que a action de cadastro aceita (recorrentes e com preço na
  // Stripe). Os identificadores da Stripe ficam no servidor: o formulário só
  // precisa saber o que desenhar.
  const registrationPlans = plans
    .filter((plan) => plan.billingInterval !== "one_time" && plan.stripePriceId)
    .map((plan) => ({
      ...plan,
      stripeProductId: null,
      stripePriceId: null,
      stripePaymentLinkId: null,
      stripePaymentLinkUrl: null,
      syncError: null,
    }));

  return <StudentRegistrationWizard plans={registrationPlans} />;
}
