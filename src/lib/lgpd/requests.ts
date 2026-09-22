/**
 * Solicitações do titular (LGPD art. 18 e 19). Módulo puro: importado pelo
 * painel do titular, pela fila do admin e pelas actions.
 *
 * Os valores espelham os `check` da migration 0052 — mudou lá, muda aqui.
 */

import type { AppRole } from "@/types/domain";

export const LGPD_REQUEST_KINDS = [
  "access",
  "rectification",
  "deletion",
  "sharing_info",
  "consent_withdrawal",
  "automated_review",
  "other",
] as const;
export type LgpdRequestKind = (typeof LGPD_REQUEST_KINDS)[number];

export const LGPD_REQUEST_STATUSES = [
  "open",
  "in_progress",
  "fulfilled",
  "partially_fulfilled",
  "rejected",
  "canceled",
] as const;
export type LgpdRequestStatus = (typeof LGPD_REQUEST_STATUSES)[number];

/** Estados em que o pedido ainda conta no prazo. */
export const OPEN_STATUSES: readonly LgpdRequestStatus[] = ["open", "in_progress"];

/** Estados finais que a coordenação pode escolher ao responder. */
export const RESOLUTION_STATUSES: readonly LgpdRequestStatus[] = [
  "fulfilled",
  "partially_fulfilled",
  "rejected",
];

export const KIND_LABEL: Record<LgpdRequestKind, string> = {
  access: "Confirmação e acesso aos dados",
  rectification: "Correção de dados",
  deletion: "Exclusão (anonimização) da conta",
  sharing_info: "Com quem meus dados são compartilhados",
  consent_withdrawal: "Retirar um consentimento",
  automated_review: "Revisão de nota automática",
  other: "Outro pedido",
};

/** Texto de apoio que aparece no formulário, abaixo da escolha. */
export const KIND_HINT: Record<LgpdRequestKind, string> = {
  access:
    "Uma declaração completa do que temos sobre você. A cópia rápida em JSON já está disponível acima.",
  rectification:
    "Diga o que está errado e o valor correto. Nome, telefone e nascimento você mesmo corrige no perfil; e-mail e CPF passam por aqui.",
  deletion:
    "Seus dados de identificação são apagados e a conta deixa de funcionar. Frequência, notas e registros financeiros ficam, sem o seu nome, pelo prazo que a lei exige. Você tem 7 dias para desistir.",
  sharing_info: "Explicamos quais empresas recebem seus dados e para quê.",
  consent_withdrawal:
    "Cookies e Google Agenda você mesmo desliga aqui na plataforma. Use este pedido para qualquer outro caso.",
  automated_review: "Informe a tarefa e a questão cuja correção automática quer revisar.",
  other: "Descreva o que precisa.",
};

export const STATUS_LABEL: Record<LgpdRequestStatus, string> = {
  open: "Recebido",
  in_progress: "Em análise",
  fulfilled: "Atendido",
  partially_fulfilled: "Atendido em parte",
  rejected: "Não atendido",
  canceled: "Cancelado",
};

/** Frase que a coordenação digita para executar a anonimização — nunca um clique só. */
export const ANONYMIZE_CONFIRMATION = "ANONIMIZAR";

/** Carência antes de a exclusão poder ser executada (plano LGPD §6.4). */
export const DELETION_GRACE_DAYS = 7;

/** Pedido de exclusão só pode ser executado depois da carência. */
export function deletionAvailableAt(createdAt: string): Date {
  return new Date(new Date(createdAt).getTime() + DELETION_GRACE_DAYS * 86_400_000);
}

/** Dias inteiros até o prazo (negativo = vencido). */
export function daysUntil(iso: string, now: number = Date.now()): number {
  return Math.ceil((new Date(iso).getTime() - now) / 86_400_000);
}

export function meusDadosPath(role: AppRole): string {
  if (role === "admin") return "/admin/meus-dados";
  if (role === "teacher") return "/professor/meus-dados";
  return "/meus-dados";
}

export interface LgpdRequestView {
  id: string;
  protocol: string;
  kind: LgpdRequestKind;
  status: LgpdRequestStatus;
  details: string | null;
  resolution: string | null;
  dueAt: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface LgpdQueueItem extends LgpdRequestView {
  requesterId: string | null;
  requesterName: string;
  requesterEmail: string;
  requesterRole: AppRole | null;
  requesterAnonymized: boolean;
  handledByName: string | null;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
