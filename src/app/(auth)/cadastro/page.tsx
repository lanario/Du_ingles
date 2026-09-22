import type { Metadata } from "next";
import {
  StudentRegistrationWizard,
  type RegistrationPlan,
} from "@/components/features/auth/student-registration-wizard";
import { getDefaultOrganizationId } from "@/lib/organization";
import { listPublicPlans } from "@/repositories/student-plans";

export const metadata: Metadata = { title: "Cadastro de aluno" };

export default async function CadastroPage() {
  const organizationId = await getDefaultOrganizationId();
  const plans = await listPublicPlans(organizationId);

  const registrationPlans: RegistrationPlan[] = plans
    .filter((plan) => plan.billingInterval !== "one_time")
    .map((plan) => ({
      id: plan.id,
      name: plan.name,
      headline: plan.headline,
      description: plan.description,
      features: plan.features,
      priceCents: plan.priceCents,
      currency: plan.currency,
      billingInterval: plan.billingInterval as RegistrationPlan["billingInterval"],
      lessonsPerMonth: plan.lessonsPerMonth,
      minutesPerLesson: plan.minutesPerLesson,
    }));

  return <StudentRegistrationWizard plans={registrationPlans} />;
}
