import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { generateInviteToken, hashInviteToken } from "@/lib/invite-token";
import type { AppRole } from "@/types/domain";
import type { AcceptInviteInput, CreateInviteInput } from "@/schemas/invites";

/** Validade do link. Curta o bastante para um link vazado envelhecer sozinho. */
const INVITE_TTL_DAYS = 7;

export interface InviteSummary {
  id: string;
  fullName: string;
  phone: string;
  role: AppRole;
  expiresAt: string;
}

/**
 * Tudo aqui passa pelo client service-role de propósito: o aceite acontece
 * SEM sessão (o convidado ainda não existe em `auth.users`), então não há
 * RLS que possa autorizá-lo. A tabela não tem policy de escrita nenhuma —
 * ver a migration `20260818_user_invites.sql`.
 */

export type CreateInviteResult =
  | { success: true; invite: InviteSummary; token: string }
  | { success: false; message: string };

export async function createInvite(
  input: CreateInviteInput,
  organizationId: string,
  createdBy: string,
): Promise<CreateInviteResult> {
  const admin = createAdminSupabaseClient();

  // Reenviar para o mesmo número é operação normal (o primeiro link se
  // perdeu na conversa). Revogar o anterior mantém válido o índice parcial
  // de convite pendente único e mata o link antigo — dois links vivos para
  // a mesma pessoa seria um convite a duas contas.
  await admin
    .from("user_invites")
    .update({ status: "revoked" })
    .eq("organization_id", organizationId)
    .eq("phone", input.phone)
    .eq("status", "pending");

  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString();

  const { data, error } = await admin
    .from("user_invites")
    .insert({
      organization_id: organizationId,
      role: input.role as AppRole,
      full_name: input.fullName,
      phone: input.phone,
      token_hash: hashInviteToken(token),
      expires_at: expiresAt,
      created_by: createdBy,
    })
    .select("id, full_name, phone, role, expires_at")
    .single();

  if (error || !data) {
    return { success: false, message: "Falha ao gerar o convite." };
  }

  return {
    success: true,
    token,
    invite: {
      id: data.id,
      fullName: data.full_name,
      phone: data.phone,
      role: data.role,
      expiresAt: data.expires_at,
    },
  };
}

export type InviteLookup =
  | { status: "valid"; invite: InviteSummary; organizationId: string }
  | { status: "expired" | "accepted" | "revoked" | "not_found" };

/**
 * Resolve o token da URL. Devolve o motivo da recusa em vez de um `null`
 * mudo — a página do convidado precisa dizer se o link expirou, se já foi
 * usado ou se nunca existiu, senão o suporte vira adivinhação.
 */
export async function getInviteByToken(token: string): Promise<InviteLookup> {
  if (!token) return { status: "not_found" };

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("user_invites")
    .select("id, organization_id, full_name, phone, role, status, expires_at")
    .eq("token_hash", hashInviteToken(token))
    .maybeSingle();

  if (error || !data) return { status: "not_found" };
  if (data.status === "accepted") return { status: "accepted" };
  if (data.status === "revoked") return { status: "revoked" };
  if (new Date(data.expires_at).getTime() < Date.now()) return { status: "expired" };

  return {
    status: "valid",
    organizationId: data.organization_id,
    invite: {
      id: data.id,
      fullName: data.full_name,
      phone: data.phone,
      role: data.role,
      expiresAt: data.expires_at,
    },
  };
}

export type AcceptInviteResult =
  | { success: true; userId: string; organizationId: string; role: AppRole }
  | {
      success: false;
      reason: "invite_invalid" | "email_taken" | "cpf_taken" | "internal";
      message: string;
    };

/**
 * Converte o convite em conta: `auth.users`, `profiles` e o subtipo do
 * papel, e fecha o convite. Não é uma transação de verdade (o usuário de
 * auth vive fora do Postgres da aplicação), então cada passo que falha
 * desfaz o anterior — nunca deixamos login sem profile.
 */
export async function acceptInvite(
  token: string,
  input: AcceptInviteInput,
): Promise<AcceptInviteResult> {
  const admin = createAdminSupabaseClient();

  const lookup = await getInviteByToken(token);
  if (lookup.status !== "valid") {
    return {
      success: false,
      reason: "invite_invalid",
      message: "Este convite não é mais válido. Peça um novo link à escola.",
    };
  }

  const { invite, organizationId } = lookup;

  // CPF é único por organização no banco; checar antes evita criar o
  // usuário de auth só para descobrir a colisão no insert do profile.
  const { data: existingCpf } = await admin
    .from("profiles")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("cpf", input.cpf)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingCpf) {
    return {
      success: false,
      reason: "cpf_taken",
      message: "Já existe um cadastro com este CPF.",
    };
  }

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    // O convite já foi entregue no WhatsApp do próprio usuário — o e-mail
    // não é o canal de verificação aqui, e exigir confirmação deixaria a
    // conta inacessível para quem digitou um e-mail que não abre.
    email_confirm: true,
  });

  if (authError || !created?.user) {
    const alreadyRegistered =
      authError?.status === 422 || /already/i.test(authError?.message ?? "");
    if (alreadyRegistered) {
      return {
        success: false,
        reason: "email_taken",
        message: "Este e-mail já está em uso.",
      };
    }
    return {
      success: false,
      reason: "internal",
      message: "Falha ao criar a conta. Tente novamente.",
    };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    organization_id: organizationId,
    role: invite.role,
    full_name: input.fullName,
    email: input.email,
    // Telefone vem do convite, não do formulário: é o número que recebeu o link.
    phone: invite.phone,
    birth_date: input.birthDate,
    cpf: input.cpf,
    // A senha foi escolhida pelo próprio usuário — nada a trocar no primeiro acesso.
    must_change_password: false,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    const duplicate = profileError.code === "23505";
    return {
      success: false,
      reason: duplicate ? "cpf_taken" : "internal",
      message: duplicate
        ? "Já existe um cadastro com este CPF ou e-mail."
        : "Falha ao criar o perfil. Tente novamente.",
    };
  }

  if (invite.role === "teacher") {
    await admin.from("teacher_profiles").insert({
      profile_id: created.user.id,
      organization_id: organizationId,
      is_public: false,
    });
  }

  if (invite.role === "student") {
    await admin.from("student_profiles").insert({
      profile_id: created.user.id,
      organization_id: organizationId,
    });
  }

  // Fecha o convite por id E ainda pendente: se duas submissões corressem
  // juntas, só a primeira fecha — a segunda desfaz a conta que criou.
  const { data: closed } = await admin
    .from("user_invites")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_profile_id: created.user.id,
    })
    .eq("id", invite.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (!closed) {
    await admin.from("profiles").delete().eq("id", created.user.id);
    await admin.auth.admin.deleteUser(created.user.id);
    return {
      success: false,
      reason: "invite_invalid",
      message: "Este convite já foi utilizado.",
    };
  }

  return {
    success: true,
    userId: created.user.id,
    organizationId,
    role: invite.role,
  };
}
