import * as invitesRepo from "@/repositories/invites";
import { env } from "@/lib/env";
import { whatsappUrl } from "@/lib/phone";
import type { AppRole } from "@/types/domain";
import type { AcceptInviteInput, CreateInviteInput } from "@/schemas/invites";
import type { ServiceResult } from "@/services/users";

const ROLE_LABEL: Record<AppRole, string> = {
  admin: "administrador(a)",
  teacher: "professor(a)",
  student: "aluno(a)",
};

export interface InviteDelivery {
  inviteId: string;
  /** Link do cadastro. Só existe nesta resposta — no banco fica só o hash. */
  inviteUrl: string;
  /** `wa.me` com a mensagem pronta; o admin confere e envia. */
  whatsappUrl: string;
  message: string;
  phone: string;
  fullName: string;
  role: AppRole;
  expiresAt: string;
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/**
 * Texto que vai no WhatsApp. Fica no servidor junto com a criação do
 * convite para link e mensagem nunca saírem de fontes diferentes — o
 * painel só exibe o que recebe.
 */
function buildMessage(fullName: string, role: AppRole, url: string, expiresAt: string): string {
  const expires = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(expiresAt));

  return [
    `Olá, ${firstName(fullName)}! Aqui é da Du Inglês.`,
    "",
    `Seu acesso à plataforma foi liberado como ${ROLE_LABEL[role]}.`,
    "Para criar sua conta, toque no link abaixo e preencha o cadastro:",
    "",
    url,
    "",
    `O link é pessoal e vale até ${expires}.`,
  ].join("\n");
}

export async function createInvite(
  input: CreateInviteInput,
  organizationId: string,
  createdBy: string,
): Promise<ServiceResult<InviteDelivery>> {
  const result = await invitesRepo.createInvite(input, organizationId, createdBy);
  if (!result.success) return { success: false, message: result.message };

  const { invite, token } = result;
  const inviteUrl = `${env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/convite/${token}`;
  const message = buildMessage(invite.fullName, invite.role, inviteUrl, invite.expiresAt);

  return {
    success: true,
    data: {
      inviteId: invite.id,
      inviteUrl,
      whatsappUrl: whatsappUrl(invite.phone, message),
      message,
      phone: invite.phone,
      fullName: invite.fullName,
      role: invite.role,
      expiresAt: invite.expiresAt,
    },
  };
}

export async function getInviteByToken(token: string): Promise<invitesRepo.InviteLookup> {
  return invitesRepo.getInviteByToken(token);
}

export async function acceptInvite(
  token: string,
  input: AcceptInviteInput,
): Promise<invitesRepo.AcceptInviteResult> {
  return invitesRepo.acceptInvite(token, input);
}
