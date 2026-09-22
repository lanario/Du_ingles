import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { deleteAvatar } from "@/lib/avatars";
import { disconnectAndCleanup } from "@/lib/google/sync";
import { revokeUserSessions } from "@/repositories/users";
import { blockedByActiveGroups } from "@/services/users";

/**
 * Eliminação dos dados de um titular (LGPD art. 16 e 18, IV e VI).
 *
 * Anonimiza em vez de apagar: `profiles` cai em cascata junto com
 * `auth.users` e leva frequência, notas e assinaturas — que têm guarda legal
 * ou contratual (art. 16, I). O identificador sai; o histórico fica sem dono.
 *
 * Ordem importa:
 *   1. Google primeiro — a limpeza das agendas precisa do token, que a
 *      função do banco apaga.
 *   2. `anonymize_profile()` — tudo o que mora no banco, numa transação.
 *   3. O que mora fora do banco: arquivo do avatar e a conta de login.
 * Se 3 falhar, o banco já está anonimizado e a conta já não entra (sessões
 * revogadas, perfil inativo); o erro volta para a tela para repetir.
 *
 * O que NÃO é tratado aqui e precisa de gente (volta em `warnings`):
 *   - `class_sessions.teacher_notes`: texto livre do professor que pode citar
 *     o aluno pelo nome;
 *   - Stripe: o cadastro de cliente e as faturas emitidas ficam lá, sob guarda
 *     fiscal; se não houver obrigação de manter, remova pelo painel do Stripe;
 *   - gravações no Google Drive da escola.
 */

export type ErasureResult =
  /** `complete: false` = o banco foi anonimizado, mas a conta de login não; repetir conclui. */
  { ok: true; complete: boolean; warnings: string[] } | { ok: false; message: string };

// Tudo que ainda pode gerar cobrança. `paused` entra porque volta a cobrar ao retomar.
const ACTIVE_SUBSCRIPTION = [
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
  "paused",
] as const;

async function preconditions(targetId: string): Promise<string | null> {
  const admin = createAdminSupabaseClient();

  const { data: target } = await admin
    .from("profiles")
    .select("role, organization_id, anonymized_at, is_active")
    .eq("id", targetId)
    .maybeSingle();
  if (!target) return "Conta não encontrada.";
  const groups = await blockedByActiveGroups(targetId);
  if (groups && !groups.success) return groups.message;

  if (target.role === "admin" && target.is_active) {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", target.organization_id)
      .eq("role", "admin")
      .eq("is_active", true)
      .is("anonymized_at", null);
    if ((count ?? 0) <= 1) {
      return "Esta é a única conta de coordenação ativa. Crie outra antes de anonimizar esta.";
    }
  }

  const { data: subscriptions, error: subscriptionsError } = await admin
    .from("student_subscriptions")
    .select("status")
    .eq("student_id", targetId)
    .in("status", [...ACTIVE_SUBSCRIPTION]);
  // Falha fechada: sem saber se há cobrança ativa, não anonimiza.
  if (subscriptionsError)
    return "Não foi possível conferir as assinaturas. Tente de novo.";
  if ((subscriptions?.length ?? 0) > 0) {
    return "Há assinatura ativa no Stripe. Cancele pelo portal de faturas antes: anonimizar não interrompe a cobrança.";
  }

  return null;
}

/**
 * A conta de login não é apagada (cascata — ver acima). Ela deixa de
 * identificar e de funcionar: e-mail trocado pelo mesmo marcador do perfil,
 * metadados zerados, senha aleatória que ninguém conhece e banimento.
 * Idempotente: repetir não muda o resultado.
 */
async function scrubLoginAccount(targetId: string): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const marker = `removido+${targetId.replaceAll("-", "")}@anonimizado.invalid`;
  const { error } = await admin.auth.admin.updateUserById(targetId, {
    email: marker,
    email_confirm: true,
    phone: "",
    password: randomBytes(32).toString("base64url"),
    user_metadata: {},
    ban_duration: "876000h",
  });
  if (error) console.error("[lgpd] atualização do auth falhou:", error.message);
  await revokeUserSessions(targetId);
  return !error;
}

export async function anonymizeUser(targetId: string): Promise<ErasureResult> {
  const admin = createAdminSupabaseClient();
  const { data: current } = await admin
    .from("profiles")
    .select("anonymized_at")
    .eq("id", targetId)
    .maybeSingle();

  // Já anonimizada: só confere a conta de login — é a parte que pode ter
  // falhado na primeira vez, por morar fora da transação do banco.
  if (current?.anonymized_at) {
    return (await scrubLoginAccount(targetId))
      ? {
          ok: true,
          complete: true,
          warnings: ["A conta já estava anonimizada; o acesso de login foi conferido."],
        }
      : {
          ok: false,
          message: "Não foi possível atualizar a conta de login. Tente de novo.",
        };
  }

  const blocked = await preconditions(targetId);
  if (blocked) return { ok: false, message: blocked };

  const warnings: string[] = [];

  try {
    await disconnectAndCleanup(targetId);
  } catch (error) {
    // Eventos que sobrarem nas agendas são só cópias; o token some no passo 2.
    console.error("[lgpd] limpeza do Google falhou:", error);
    warnings.push(
      "Não foi possível apagar os eventos da agenda Google desta pessoa. O acesso da plataforma à conta dela foi removido mesmo assim.",
    );
  }

  const { data, error } = await admin.rpc("anonymize_profile", {
    p_profile_id: targetId,
  });
  const row = data?.[0];
  if (error || !row) {
    console.error("[lgpd] anonymize_profile falhou:", error?.message);
    return {
      ok: false,
      message:
        "Não foi possível anonimizar agora. Nada foi alterado no banco; tente de novo.",
    };
  }

  if (row.old_avatar_path) await deleteAvatar(row.old_avatar_path);

  const complete = await scrubLoginAccount(targetId);
  if (!complete) {
    warnings.push(
      "Os dados foram anonimizados, mas a conta de login ainda guarda o e-mail antigo (ela já não entra). Clique em anonimizar de novo para concluir.",
    );
  }

  if (row.teacher_note_sessions > 0) {
    warnings.push(
      `Revise as observações de ${row.teacher_note_sessions} aula(s) das turmas desta pessoa: elas são texto livre e podem citá-la pelo nome.`,
    );
  }
  warnings.push(
    "Se houver cadastro no Stripe e não existir obrigação fiscal de mantê-lo, remova pelo painel do Stripe.",
  );
  warnings.push("Gravações de aula no Google Drive da escola não são alteradas.");

  return { ok: true, complete, warnings };
}
