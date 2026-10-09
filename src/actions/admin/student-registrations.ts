"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ADMIN_BASE } from "@/lib/areas";
import { auditLog } from "@/lib/audit";
import { requireRole } from "@/lib/auth/session";
import { deleteAvatar } from "@/lib/avatars";
import { disconnectAndCleanup } from "@/lib/google/sync";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getStripe, isStripeConfigured } from "@/lib/stripe/client";
import { listStudentRegistrations } from "@/repositories/student-registrations";
import { fail, ok, type ActionResult } from "@/types/action-result";

export async function listStudentRegistrationsAction() {
  const ctx = await requireRole(["admin"]);
  return listStudentRegistrations(ctx.organizationId);
}

// Tudo que ainda pode gerar cobrança. `paused` entra porque volta a cobrar ao retomar.
const BILLING_SUBSCRIPTION = [
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
  "paused",
] as const;

const HISTORY_BLOCK =
  "Este aluno já tem histórico (aulas, presença, entregas, mensagens, objetivos ou assinatura) que precisa ser guardado. Use a anonimização pela fila LGPD em vez de excluir.";
const GENERIC_FAILURE = "Não foi possível excluir o cadastro. Tente de novo.";

const deleteSchema = z.object({
  studentId: z.string().uuid(),
  confirmation: z.string(),
});

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

/**
 * Confere o Stripe antes de apagar: um checkout aberto ainda não gerou linha em
 * `student_subscriptions`, mas, concluído depois da exclusão, viraria uma
 * assinatura cobrando alguém que a plataforma já não conhece.
 * Devolve a mensagem de bloqueio, ou `null` se pode seguir.
 */
async function stripeBlock(registration: {
  stripe_checkout_session_id: string | null;
  stripe_customer_id: string | null;
}): Promise<string | null> {
  if (!registration.stripe_checkout_session_id && !registration.stripe_customer_id) {
    return null;
  }
  // Sem Stripe configurado não há como conferir; falha fechada.
  if (!isStripeConfigured()) {
    return "Este cadastro tem dados de pagamento no Stripe e a integração não está disponível para conferir. Tente mais tarde.";
  }
  try {
    const stripe = getStripe();
    if (registration.stripe_checkout_session_id) {
      const session = await stripe.checkout.sessions.retrieve(
        registration.stripe_checkout_session_id,
      );
      if (session.status === "complete") {
        return "O checkout deste aluno foi concluído no Stripe. Aguarde a assinatura aparecer ou cancele pelo portal de faturas antes de excluir.";
      }
      if (session.status === "open") await stripe.checkout.sessions.expire(session.id);
    }
    if (registration.stripe_customer_id) {
      const subscriptions = await stripe.subscriptions.list({
        customer: registration.stripe_customer_id,
        status: "all",
        limit: 10,
      });
      if (
        subscriptions.data.some(
          (item) => item.status !== "canceled" && item.status !== "incomplete_expired",
        )
      ) {
        return "Há assinatura no Stripe para este aluno. Cancele pelo portal de faturas antes: excluir não interrompe a cobrança.";
      }
    }
  } catch (error) {
    console.error("[student-registrations] conferência do Stripe falhou:", error);
    return "Não foi possível conferir o Stripe agora. Tente de novo.";
  }
  return null;
}

/**
 * Exclusão definitiva de um cadastro novo: apaga a conta de login e, em
 * cascata, o perfil e tudo que depende dele.
 *
 * Só vale para quem ainda não gerou histórico. Frequência, notas, mensagens e
 * assinaturas têm guarda legal ou contratual — para esses o caminho é a
 * anonimização (`services/lgpd-erasure.ts`), que mantém o histórico sem
 * identificação. Todas as travas ficam no servidor, inclusive a confirmação
 * digitada; o diálogo da tela é só conveniência.
 *
 * Ordem: conferir tudo (banco e Stripe) antes de qualquer efeito colateral;
 * só então Google, matrícula e a conta de login.
 */
export async function deleteStudentRegistrationAction(
  studentId: string,
  confirmation: string,
): Promise<ActionResult<{ studentId: string }>> {
  const ctx = await requireRole(["admin"]);
  const parsed = deleteSchema.safeParse({ studentId, confirmation });
  if (!parsed.success) return fail("VALIDATION_ERROR", "Cadastro inválido.");
  const id = parsed.data.studentId;

  if (id === ctx.userId) {
    return fail("FORBIDDEN", "Você não pode excluir a sua própria conta.");
  }

  const admin = createAdminSupabaseClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, organization_id, anonymized_at, avatar_url, full_name, email")
    .eq("id", id)
    .maybeSingle();
  if (
    !profile ||
    profile.organization_id !== ctx.organizationId ||
    profile.role !== "student" ||
    profile.anonymized_at
  ) {
    return fail("NOT_FOUND", "Cadastro não encontrado.");
  }
  if (normalize(parsed.data.confirmation) !== normalize(profile.full_name)) {
    return fail("VALIDATION_ERROR", "Digite o nome do aluno para confirmar.");
  }

  const head = { count: "exact", head: true } as const;
  const [
    attendance,
    submissions,
    subscriptions,
    messages,
    objectives,
    conversations,
    registration,
    invites,
  ] = await Promise.all([
    admin.from("attendance").select("id", head).eq("student_id", id),
    admin
      .from("assignment_submissions")
      .select("id", head)
      .eq("student_id", id)
      .or(
        "submitted_at.not.is.null,graded_at.not.is.null,score.not.is.null,manual_grades.not.is.null,status.neq.pending",
      ),
    admin.from("student_subscriptions").select("status").eq("student_id", id),
    admin.from("messages").select("id", head).eq("sender_id", id),
    admin
      .from("learning_objectives")
      .select("id", head)
      .or(`student_id.eq.${id},created_by.eq.${id},completed_by.eq.${id}`),
    admin
      .from("conversations")
      .select("id", head)
      .or(`created_by.eq.${id},posting_changed_by.eq.${id}`),
    admin
      .from("student_registrations")
      .select("stripe_checkout_session_id, stripe_customer_id")
      .eq("profile_id", id)
      .maybeSingle(),
    admin.from("user_invites").select("id").eq("accepted_profile_id", id),
  ]);

  // Falha fechada: sem conseguir conferir o histórico, não apaga.
  if (
    attendance.error ||
    submissions.error ||
    subscriptions.error ||
    messages.error ||
    objectives.error ||
    conversations.error ||
    registration.error ||
    invites.error
  ) {
    return fail("INTERNAL_ERROR", "Não foi possível conferir o histórico. Tente de novo.");
  }

  const statuses = (subscriptions.data ?? []).map((row) => row.status as string);
  if (statuses.some((status) => (BILLING_SUBSCRIPTION as readonly string[]).includes(status))) {
    return fail(
      "CONFLICT",
      "Há assinatura ativa no Stripe. Cancele pelo portal de faturas antes: excluir não interrompe a cobrança.",
    );
  }
  if (
    (attendance.count ?? 0) > 0 ||
    (submissions.count ?? 0) > 0 ||
    (messages.count ?? 0) > 0 ||
    (objectives.count ?? 0) > 0 ||
    (conversations.count ?? 0) > 0 ||
    statuses.some((status) => status !== "incomplete_expired")
  ) {
    return fail("CONFLICT", HISTORY_BLOCK);
  }

  if (registration.data) {
    const blocked = await stripeBlock(registration.data);
    if (blocked) return fail("CONFLICT", blocked);
  }

  // O token do Google some com o perfil, e a limpeza das agendas precisa dele.
  try {
    await disconnectAndCleanup(id);
  } catch (error) {
    console.error("[student-registrations] limpeza do Google falhou:", error);
  }

  // Matrícula sem aula nem presença é só uma designação: sai junto.
  const { error: enrollmentError } = await admin
    .from("enrollments")
    .delete()
    .eq("student_id", id)
    .eq("organization_id", ctx.organizationId);
  if (enrollmentError) {
    console.error("[student-registrations] matrícula não removida:", enrollmentError.message);
    return fail("INTERNAL_ERROR", GENERIC_FAILURE);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(id);
  if (deleteError) {
    console.error("[student-registrations] deleteUser falhou:", deleteError.message);
    return fail("INTERNAL_ERROR", GENERIC_FAILURE);
  }

  // A conta já não existe: a auditoria vem logo, antes de qualquer limpeza que possa falhar.
  // O log fica sem o nome: `actor` é quem executou; o alvo é só o id.
  await auditLog({
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorRole: ctx.realRole,
    action: "STUDENT_REGISTRATION_DELETED",
    entityType: "profile",
    entityId: id,
  });

  // Identificadores que as FKs só desligam (`set null`) e que ainda apontariam
  // para a pessoa. Melhor esforço: a conta já foi apagada.
  const marker = `removido+${id.replaceAll("-", "")}@anonimizado.invalid`;
  try {
    // `ilike` trata `_` e `%` como curinga; e-mail costuma ter `_`.
    const email = profile.email.replace(/[\\%_]/g, "\\$&");
    await Promise.all([
      admin.from("leads").delete().ilike("email", email),
      admin
        .from("consent_records")
        .update({ subject_email: null, ip_address: null, user_agent: null })
        .ilike("subject_email", email),
      admin
        .from("lgpd_requests")
        .update({ requester_name: "Titular removido", requester_email: marker })
        .ilike("requester_email", email),
      ...(invites.data ?? []).map((invite) =>
        admin
          .from("user_invites")
          .update({ full_name: "Titular removido", phone: "-" })
          .eq("id", invite.id),
      ),
    ]);
  } catch (error) {
    console.error("[student-registrations] limpeza de dados residuais falhou:", error);
  }

  if (profile.avatar_url) {
    try {
      await deleteAvatar(profile.avatar_url);
    } catch (error) {
      console.error("[student-registrations] avatar não removido:", error);
    }
  }

  revalidatePath(`${ADMIN_BASE}/alunos`);
  revalidatePath(`${ADMIN_BASE}/usuarios`);
  return ok({ studentId: id });
}
