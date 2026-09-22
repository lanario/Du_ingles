"use server";

import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { isStripeConfigured, stripeErrorMessage } from "@/lib/stripe/client";
import { createCheckoutSession } from "@/lib/stripe/checkout";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDefaultOrganizationId } from "@/lib/organization";
import { studentRegistrationSchema } from "@/schemas/student-registration";
import {
  PRIVACY_POLICY_VERSION,
  TERMS_VERSION,
  recordConsent,
} from "@/lib/consent/record";
import { getStudentPlan } from "@/repositories/student-plans";
import { fail, ok, type ActionResult } from "@/types/action-result";

export async function registerStudentAction(
  _prev: ActionResult<{ url: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  const parsed = studentRegistrationSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    isAdult: formData.get("isAdult"),
    guardianName: formData.get("guardianName") ?? "",
    guardianPhone: formData.get("guardianPhone") ?? "",
    guardianEmail: formData.get("guardianEmail") ?? "",
    goal: formData.get("goal") ?? "",
    focusTopics: formData.getAll("focusTopics"),
    learningStyles: formData.getAll("learningStyles"),
    studySituation: formData.get("studySituation"),
    profession: formData.get("profession") ?? "",
    professionOther: formData.get("professionOther") ?? "",
    planId: formData.get("planId"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    consent: formData.get("consent"),
    contactConsent: formData.get("contactConsent"),
  });

  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      "Revise os dados do cadastro.",
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  const input = parsed.data;
  const ip = await getClientIp();
  const allowed = await checkRateLimit(
    `${ip}:${input.email}`,
    "student_registration",
    5,
    3600,
  );
  if (!allowed) {
    return fail("RATE_LIMITED", "Muitas tentativas. Tente novamente mais tarde.");
  }

  if (!isStripeConfigured()) {
    return fail(
      "INTERNAL_ERROR",
      "O cadastro e os pagamentos estão temporariamente indisponíveis.",
    );
  }

  const organizationId = await getDefaultOrganizationId();
  const plan = await getStudentPlan(input.planId, organizationId);
  if (
    !plan ||
    !plan.isActive ||
    !plan.isPublic ||
    !plan.stripePriceId ||
    plan.billingInterval === "one_time"
  ) {
    return fail("NOT_FOUND", "Este plano não está disponível para cadastro.");
  }

  const admin = createAdminSupabaseClient();
  if (plan.seatLimit !== null) {
    const { count } = await admin
      .from("student_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", plan.id)
      .in("status", ["active", "trialing", "past_due"]);
    if ((count ?? 0) >= plan.seatLimit) {
      return fail("CONFLICT", "As vagas deste plano se esgotaram. Escolha outra opção.");
    }
  }

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    const detail = `${authError?.code ?? ""} ${authError?.message ?? ""}`;
    if (/already|exists|registered/i.test(detail)) {
      return fail(
        "CONFLICT",
        "Este e-mail já tem uma conta. Entre ou recupere sua senha.",
        {
          email: ["Este e-mail já tem uma conta. Entre ou recupere sua senha."],
        },
      );
    }
    return fail(
      "INTERNAL_ERROR",
      "Não foi possível criar sua conta. Confira os dados e tente novamente.",
    );
  }

  const userId = authData.user.id;
  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    organization_id: organizationId,
    role: "student",
    full_name: input.fullName,
    email: input.email,
    phone: input.phone,
    must_change_password: false,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    if (profileError.code === "23505") {
      return fail(
        "CONFLICT",
        "Este e-mail já tem uma conta. Entre ou recupere sua senha.",
        {
          email: ["Este e-mail já tem uma conta. Entre ou recupere sua senha."],
        },
      );
    }
    return fail(
      "INTERNAL_ERROR",
      "Não foi possível salvar seu cadastro. Tente novamente.",
    );
  }

  const { error: studentProfileError } = await admin.from("student_profiles").insert({
    profile_id: userId,
    organization_id: organizationId,
    goals: input.goal || null,
    guardian_name: input.isAdult === "no" ? input.guardianName : null,
    guardian_phone: input.isAdult === "no" ? input.guardianPhone : null,
    guardian_email: input.isAdult === "no" ? input.guardianEmail || null : null,
  });

  const { error: registrationError } = studentProfileError
    ? { error: studentProfileError }
    : await admin.from("student_registrations").insert({
        profile_id: userId,
        organization_id: organizationId,
        requested_plan_id: plan.id,
        answers: {
          isAdult: input.isAdult === "yes",
          guardianName: input.isAdult === "no" ? input.guardianName : "",
          guardianPhone: input.isAdult === "no" ? input.guardianPhone : "",
          guardianEmail: input.isAdult === "no" ? input.guardianEmail : "",
          goal: input.goal,
          focusTopics: input.focusTopics,
          learningStyles: input.learningStyles,
          studySituation: input.studySituation,
          profession: input.profession,
          professionOther: input.profession === "other" ? input.professionOther : "",
          contactConsent: true,
        },
      });

  if (registrationError) {
    await admin.from("student_profiles").delete().eq("profile_id", userId);
    await admin.from("profiles").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId);
    console.error(
      "[student-registration] falha ao salvar respostas:",
      registrationError.message,
    );
    return fail(
      "INTERNAL_ERROR",
      "Não foi possível salvar suas respostas. Tente novamente.",
    );
  }

  await recordConsent({
    organizationId,
    purpose: "terms_and_privacy",
    granted: true,
    documentVersion: `termos:${TERMS_VERSION};privacidade:${PRIVACY_POLICY_VERSION}`,
    subjectId: userId,
    subjectEmail: input.email,
    choices: { legalRepresentative: input.isAdult === "no" },
  });
  await recordConsent({
    organizationId,
    purpose: "trial_class",
    granted: true,
    documentVersion: PRIVACY_POLICY_VERSION,
    subjectId: userId,
    subjectEmail: input.email,
    choices: {
      channels: ["email", "whatsapp"],
      legalRepresentative: input.isAdult === "no",
    },
  });

  const supabase = await createServerSupabaseClient();
  const { error: loginError } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (loginError) {
    console.error(
      "[student-registration] conta criada, mas o primeiro login falhou:",
      loginError.message,
    );
    return ok({ url: "/login?cadastro=feito" });
  }

  try {
    const url = await createCheckoutSession({
      plan,
      studentId: userId,
      studentName: input.fullName,
      studentEmail: input.email,
      organizationId,
      trialDaysOverride: 7,
      onCustomerReady: async (stripeCustomerId) => {
        const { error } = await admin
          .from("student_registrations")
          .update({ stripe_customer_id: stripeCustomerId })
          .eq("profile_id", userId);
        if (error) throw error;
      },
      onSessionCreated: async (stripeCheckoutSessionId) => {
        const { error } = await admin
          .from("student_registrations")
          .update({ stripe_checkout_session_id: stripeCheckoutSessionId })
          .eq("profile_id", userId);
        if (error) throw error;
      },
    });
    return ok({ url });
  } catch (error) {
    console.error(
      "[student-registration] falha ao abrir checkout:",
      stripeErrorMessage(error),
    );
    return ok({ url: "/planos?assinatura=pendente" });
  }
}
