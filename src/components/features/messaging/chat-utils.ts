/**
 * Lógica pura do chat de turma: agrupamento das mensagens e formatação de
 * data/hora. Fica fora dos componentes porque é o que mais muda de forma —
 * e porque agrupar bolhas no meio do JSX é a receita para a lista piscar a
 * cada mensagem nova.
 */

import type { ChatMessage, GroupChatSummary } from "@/repositories/group-chats";

export { CEFR_TONE } from "@/components/features/admin/students/students-utils";
export {
  initialsOf,
  ROLE_TONE,
  toneOf,
} from "@/components/features/admin/users/users-utils";

/** Mensagens do mesmo autor dentro desta janela viram uma bolha só. */
const RUN_WINDOW_MS = 5 * 60 * 1000;

export interface MessageRun {
  key: string;
  senderId: string;
  senderName: string;
  senderRole: ChatMessage["senderRole"];
  messages: ChatMessage[];
}

export interface MessageDay {
  key: string;
  label: string;
  runs: MessageRun[];
}

function startOfDay(iso: string): number {
  const date = new Date(iso);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * "Hoje"/"Ontem" para os dois dias que o aluno realmente reconhece de cabeça;
 * o resto vira data por extenso — "12 de março" é mais legível num separador
 * do que "12/03/2026".
 */
export function dayLabel(iso: string): string {
  const day = startOfDay(iso);
  const today = startOfDay(new Date().toISOString());
  const oneDay = 24 * 60 * 60 * 1000;

  if (day === today) return "Hoje";
  if (day === today - oneDay) return "Ontem";

  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Carimbo da lista lateral: hora hoje, dia da semana na semana, data depois. */
export function relativeStamp(iso: string | null): string {
  if (!iso) return "";
  const day = startOfDay(iso);
  const today = startOfDay(new Date().toISOString());
  const oneDay = 24 * 60 * 60 * 1000;

  if (day === today) return timeLabel(iso);
  if (day === today - oneDay) return "ontem";
  if (today - day < 7 * oneDay) {
    return new Date(iso)
      .toLocaleDateString("pt-BR", { weekday: "short" })
      .replace(".", "");
  }
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/**
 * Mensagens → dias → sequências do mesmo autor. Uma passada só sobre a lista
 * (que já vem ordenada do banco), sem ordenação nem busca aninhada.
 */
export function groupMessages(messages: ChatMessage[]): MessageDay[] {
  const days: MessageDay[] = [];

  for (const message of messages) {
    const dayKey = String(startOfDay(message.createdAt));
    let day = days[days.length - 1];

    if (!day || day.key !== dayKey) {
      day = { key: dayKey, label: dayLabel(message.createdAt), runs: [] };
      days.push(day);
    }

    const run = day.runs[day.runs.length - 1];
    const continuesRun =
      run &&
      run.senderId === message.senderId &&
      new Date(message.createdAt).getTime() -
        new Date(run.messages[run.messages.length - 1]!.createdAt).getTime() <
        RUN_WINDOW_MS;

    if (continuesRun) {
      run.messages.push(message);
    } else {
      day.runs.push({
        key: message.id,
        senderId: message.senderId,
        senderName: message.senderName,
        senderRole: message.senderRole,
        messages: [message],
      });
    }
  }

  return days;
}

/** Busca da lista lateral: nome da turma, professor ou prévia da conversa. */
export function filterChats(chats: GroupChatSummary[], term: string): GroupChatSummary[] {
  const query = term.trim().toLowerCase();
  if (!query) return chats;

  return chats.filter((chat) =>
    [chat.groupName, chat.teacherName, chat.lastMessageBody ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(query),
  );
}

export function totalUnread(chats: GroupChatSummary[]): number {
  return chats.reduce((sum, chat) => sum + chat.unreadCount, 0);
}
