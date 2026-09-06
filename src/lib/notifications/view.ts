import type { ComponentType } from "react";
import {
  BellIcon,
  CalendarIcon,
  CoinIcon,
  GraduationIcon,
  GroupsIcon,
  type IconProps,
  KeyIcon,
  MailIcon,
  MegaphoneIcon,
  MessageIcon,
  ShieldIcon,
  SparkleIcon,
  SwapIcon,
  TaskIcon,
} from "@/components/ui/icons";

/**
 * Vocabulário visual das notificações. `notifications.type` é uma coluna de
 * texto livre — o servidor grava rótulos em caixas diferentes ("announcement",
 * "GROUP_CHANGE_REQUEST"), e novos tipos aparecem sem tocar no cliente. Por
 * isso o mapa é normalizado em minúsculas e existe um fallback por
 * palavra-chave: um tipo desconhecido ainda cai num ícone plausível em vez do
 * sino genérico.
 */

export type NotificationTone =
  "gold" | "navy" | "info" | "success" | "warning" | "danger" | "neutral";

export interface NotificationVisual {
  icon: ComponentType<IconProps>;
  tone: NotificationTone;
  /** Rótulo curto exibido como chip no item. */
  label: string;
}

const ANNOUNCEMENT: NotificationVisual = {
  icon: MegaphoneIcon,
  tone: "gold",
  label: "Aviso",
};
const LGPD: NotificationVisual = { icon: ShieldIcon, tone: "navy", label: "LGPD" };
const GROUP: NotificationVisual = { icon: GroupsIcon, tone: "info", label: "Turma" };
const MESSAGE: NotificationVisual = {
  icon: MessageIcon,
  tone: "info",
  label: "Mensagem",
};
const TASK: NotificationVisual = { icon: TaskIcon, tone: "warning", label: "Tarefa" };
const LESSON: NotificationVisual = { icon: GraduationIcon, tone: "navy", label: "Aula" };
const SCHEDULE: NotificationVisual = {
  icon: CalendarIcon,
  tone: "navy",
  label: "Agenda",
};
const PAYMENT: NotificationVisual = {
  icon: CoinIcon,
  tone: "success",
  label: "Financeiro",
};

const ACCOUNT: NotificationVisual = { icon: ShieldIcon, tone: "navy", label: "Conta" };

const LEAD: NotificationVisual = { icon: MailIcon, tone: "gold", label: "Contato" };

/**
 * Os tipos gravados por `lib/notifications/events.ts`. O que não estiver aqui
 * ainda cai no fallback por palavra-chave — o mapa é conveniência, não
 * contrato.
 */
const EXACT: Record<string, NotificationVisual> = {
  announcement: ANNOUNCEMENT,
  lgpd_request: LGPD,
  group_change_request: { icon: SwapIcon, tone: "info", label: "Turma" },
  group_change_approved: { icon: SwapIcon, tone: "success", label: "Turma" },
  group_change_rejected: { icon: SwapIcon, tone: "danger", label: "Turma" },
  message: MESSAGE,
  chat_message: MESSAGE,
  chat_posting_changed: { icon: MessageIcon, tone: "warning", label: "Mensagem" },
  assignment: TASK,
  assignment_created: TASK,
  assignment_deleted: { icon: TaskIcon, tone: "danger", label: "Tarefa" },
  assignment_submitted: { icon: TaskIcon, tone: "info", label: "Entrega" },
  assignment_graded: { icon: TaskIcon, tone: "success", label: "Nota" },
  lesson: LESSON,
  session_scheduled: SCHEDULE,
  session_rescheduled: { icon: CalendarIcon, tone: "warning", label: "Agenda" },
  session_cancelled: { icon: CalendarIcon, tone: "danger", label: "Agenda" },
  session_started: { icon: GraduationIcon, tone: "success", label: "Aula" },
  session_completed: LESSON,
  attendance_recorded: { icon: GraduationIcon, tone: "warning", label: "Presença" },
  enrollment_created: { icon: GroupsIcon, tone: "success", label: "Turma" },
  enrollment_transferred: { icon: SwapIcon, tone: "info", label: "Turma" },
  enrollment_removed: { icon: GroupsIcon, tone: "danger", label: "Turma" },
  group_created: GROUP,
  group_archived: { icon: GroupsIcon, tone: "danger", label: "Turma" },
  group_reactivated: { icon: GroupsIcon, tone: "success", label: "Turma" },
  group_handover: { icon: SwapIcon, tone: "navy", label: "Turma" },
  group_schedule_changed: { icon: CalendarIcon, tone: "warning", label: "Agenda" },
  agenda_event_created: SCHEDULE,
  agenda_event_updated: { icon: CalendarIcon, tone: "warning", label: "Agenda" },
  agenda_event_deleted: { icon: CalendarIcon, tone: "danger", label: "Agenda" },
  lead_received: LEAD,
  trial_request: { icon: SparkleIcon, tone: "gold", label: "Experimental" },
  invite_created: { icon: MailIcon, tone: "info", label: "Convite" },
  invite_accepted: { icon: GroupsIcon, tone: "success", label: "Conta" },
  role_changed: ACCOUNT,
  password_reset: { icon: ShieldIcon, tone: "warning", label: "Conta" },
  password_changed: { icon: KeyIcon, tone: "warning", label: "Segurança" },
  schedule: SCHEDULE,
  payment: PAYMENT,
  payment_succeeded: PAYMENT,
  payment_failed: { icon: CoinIcon, tone: "danger", label: "Financeiro" },
};

const KEYWORDS: ReadonlyArray<[readonly string[], NotificationVisual]> = [
  [["announc", "aviso", "comunicad"], ANNOUNCEMENT],
  [["lgpd", "privac", "consent"], LGPD],
  [["group", "turma", "class"], GROUP],
  [["message", "chat", "mensagem"], MESSAGE],
  [["task", "tarefa", "assignment", "homework"], TASK],
  [["lesson", "aula", "plan"], LESSON],
  [["schedule", "agenda", "calendar", "remind"], SCHEDULE],
  [["pay", "invoice", "financ", "fatura", "cobran"], PAYMENT],
  [["lead", "contato", "experimental"], LEAD],
  [["invite", "convite", "senha", "password", "conta", "acesso"], ACCOUNT],
];

const FALLBACK: NotificationVisual = {
  icon: BellIcon,
  tone: "neutral",
  label: "Notificação",
};

export function visualFor(type: string): NotificationVisual {
  const key = type
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const exact = EXACT[key];
  if (exact) return exact;

  for (const [needles, visual] of KEYWORDS) {
    if (needles.some((needle) => key.includes(needle))) return visual;
  }
  return FALLBACK;
}

/* ------------------------------------------------------------------ tempo */

/**
 * Rótulo relativo curto ("agora", "12 min", "3 h", "ontem", "14 de mar").
 * Só é chamado depois da montagem — o painel nunca renderiza no servidor —,
 * então não há risco de divergência de hidratação com o relógio do cliente.
 */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const stamp = new Date(iso).getTime();
  if (Number.isNaN(stamp)) return "";

  const minutes = Math.floor(Math.max(0, now - stamp) / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;

  // Sem "ontem" aqui: a lista já separa os itens sob um cabeçalho "Ontem", e
  // repetir a palavra na linha só ocuparia o espaço do relógio à toa.
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d`;

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    ...(new Date(stamp).getFullYear() === new Date(now).getFullYear()
      ? {}
      : { year: "numeric" }),
  }).format(stamp);
}

/** Data e hora completas — vai no `title` do item, para quem precisar do exato. */
export function fullTimestamp(iso: string): string {
  const stamp = new Date(iso).getTime();
  if (Number.isNaN(stamp)) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(stamp);
}

export type NotificationBucket = "hoje" | "ontem" | "semana" | "antes";

export const BUCKET_LABEL: Record<NotificationBucket, string> = {
  hoje: "Hoje",
  ontem: "Ontem",
  semana: "Últimos 7 dias",
  antes: "Mais antigas",
};

const BUCKET_ORDER: readonly NotificationBucket[] = ["hoje", "ontem", "semana", "antes"];

/** Diferença em dias de calendário local (não em janelas de 24 h). */
function calendarDaysAgo(iso: string, now: Date): number {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return Number.POSITIVE_INFINITY;
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const b = new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime();
  return Math.round((a - b) / 86_400_000);
}

export function bucketOf(iso: string, now: Date = new Date()): NotificationBucket {
  const days = calendarDaysAgo(iso, now);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days <= 7) return "semana";
  return "antes";
}

/**
 * Agrupa preservando a ordem recebida (mais recentes primeiro) e devolve só os
 * grupos não vazios, já na ordem cronológica dos rótulos.
 */
export function groupByBucket<T extends { createdAt: string }>(
  items: readonly T[],
  now: Date = new Date(),
): Array<{ bucket: NotificationBucket; label: string; items: T[] }> {
  const buckets = new Map<NotificationBucket, T[]>();
  for (const item of items) {
    const bucket = bucketOf(item.createdAt, now);
    const list = buckets.get(bucket);
    if (list) list.push(item);
    else buckets.set(bucket, [item]);
  }
  return BUCKET_ORDER.filter((bucket) => buckets.has(bucket)).map((bucket) => ({
    bucket,
    label: BUCKET_LABEL[bucket],
    items: buckets.get(bucket) as T[],
  }));
}
