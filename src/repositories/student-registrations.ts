import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import type { SubscriptionStatus } from "@/repositories/student-subscriptions";

export interface RegistrationAnswers {
  isAdult: boolean;
  contactConsent: boolean;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  goal: string;
  focusTopics: string[];
  learningStyles: string[];
  studySituation: string;
  profession: string;
  professionOther: string;
}

export interface StudentRegistration {
  studentId: string;
  fullName: string;
  email: string;
  phone: string | null;
  submittedAt: string;
  requestedPlanId: string | null;
  requestedPlanName: string | null;
  answers: RegistrationAnswers;
  subscriptionStatus: SubscriptionStatus | null;
  trialEnd: string | null;
}

const EMPTY_ANSWERS: RegistrationAnswers = {
  isAdult: true,
  contactConsent: false,
  guardianName: "",
  guardianPhone: "",
  guardianEmail: "",
  goal: "",
  focusTopics: [],
  learningStyles: [],
  studySituation: "personal",
  profession: "",
  professionOther: "",
};

function answersOf(value: Json): RegistrationAnswers {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    return EMPTY_ANSWERS;
  }
  const row = value as Record<string, Json | undefined>;
  const strings = (input: Json | undefined) =>
    Array.isArray(input)
      ? input.filter((item): item is string => typeof item === "string")
      : [];
  const string = (input: Json | undefined) => (typeof input === "string" ? input : "");
  return {
    isAdult: row.isAdult !== false,
    contactConsent: row.contactConsent === true,
    guardianName: string(row.guardianName),
    guardianPhone: string(row.guardianPhone),
    guardianEmail: string(row.guardianEmail),
    goal: string(row.goal),
    focusTopics: strings(row.focusTopics),
    learningStyles: strings(row.learningStyles),
    studySituation: string(row.studySituation) || "personal",
    profession: string(row.profession),
    professionOther: string(row.professionOther),
  };
}

export async function listStudentRegistrations(
  organizationId: string,
): Promise<StudentRegistration[]> {
  const admin = createAdminSupabaseClient();
  const { data: registrations } = await admin
    .from("student_registrations")
    .select("profile_id, requested_plan_id, answers, submitted_at")
    .eq("organization_id", organizationId)
    .order("submitted_at", { ascending: false });

  const rows = registrations ?? [];
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.profile_id);
  const planIds = Array.from(
    new Set(
      rows.map((row) => row.requested_plan_id).filter((id): id is string => Boolean(id)),
    ),
  );

  const [{ data: profiles }, { data: plans }, { data: subscriptions }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("id, full_name, email, phone")
        .in("id", ids)
        .is("deleted_at", null),
      planIds.length
        ? admin.from("student_plans").select("id, name").in("id", planIds)
        : Promise.resolve({ data: [] }),
      admin
        .from("student_subscriptions")
        .select("student_id, status, trial_end, created_at")
        .in("student_id", ids)
        .order("created_at", { ascending: false }),
    ]);

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const planNameById = new Map((plans ?? []).map((plan) => [plan.id, plan.name]));
  const subscriptionByStudent = new Map<
    string,
    typeof subscriptions extends (infer T)[] | null ? T : never
  >();
  for (const subscription of subscriptions ?? []) {
    if (!subscriptionByStudent.has(subscription.student_id)) {
      subscriptionByStudent.set(subscription.student_id, subscription);
    }
  }

  return rows.flatMap((row) => {
    const profile = profileById.get(row.profile_id);
    if (!profile) return [];
    const subscription = subscriptionByStudent.get(row.profile_id);
    return [
      {
        studentId: profile.id,
        fullName: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        submittedAt: row.submitted_at,
        requestedPlanId: row.requested_plan_id,
        requestedPlanName: row.requested_plan_id
          ? (planNameById.get(row.requested_plan_id) ?? null)
          : null,
        answers: answersOf(row.answers),
        subscriptionStatus:
          (subscription?.status as SubscriptionStatus | undefined) ?? null,
        trialEnd: subscription?.trial_end ?? null,
      },
    ];
  });
}
