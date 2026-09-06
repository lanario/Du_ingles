/**
 * Contas da agenda — data, hora e sobreposição.
 *
 * Nada aqui toca no DOM nem em estado: a vista chama estas funções e desenha
 * o resultado. Duas decisões atravessam o arquivo inteiro:
 *
 * 1. **O fuso é o da escola, sempre.** O servidor manda instante em UTC
 *    (`startsAt`); quem lê está em São Paulo, e uma aula das 19h tem que
 *    aparecer às 19h mesmo para quem abrir a tela de outro fuso. Por isso
 *    cada item é convertido uma única vez, no `placeItems`, e o resto do
 *    código trabalha com `yyyy-MM-dd` + minutos do dia — nunca com `Date`.
 *
 * 2. **Dia é string, não objeto.** Comparar `"2026-09-06"` com `===` não tem
 *    horário de verão, não tem meia-noite ambígua e serve de chave de mapa.
 */

import { formatInTimeZone } from "date-fns-tz";
import { SCHOOL_TZ } from "@/lib/schedule/session-preview";
import type { AgendaItem } from "@/repositories/agenda";
import type { AgendaAudience, AgendaEventKind, SessionStatus } from "@/types/domain";

export type AgendaViewMode = "dia" | "semana" | "mes" | "lista";

/** Como a barra lateral recorta a agenda: um tipo de compromisso por chave. */
export type AgendaKindFilter =
  "session" | "preview" | "meeting" | "event" | "exam" | "holiday" | "reminder";

export const AGENDA_KIND_FILTERS: readonly AgendaKindFilter[] = [
  "session",
  "preview",
  "meeting",
  "event",
  "exam",
  "holiday",
  "reminder",
];

export const KIND_LABEL: Record<AgendaKindFilter, string> = {
  session: "Aulas",
  preview: "Prévia da grade",
  meeting: "Reuniões",
  event: "Eventos",
  exam: "Provas",
  holiday: "Feriados e recessos",
  reminder: "Lembretes",
};

/** Rótulo no singular — cabeçalho do painel de detalhe. */
export const KIND_SINGULAR: Record<AgendaKindFilter, string> = {
  session: "Aula",
  preview: "Aula prevista",
  meeting: "Reunião",
  event: "Evento",
  exam: "Prova",
  holiday: "Feriado / recesso",
  reminder: "Lembrete",
};

export const EVENT_KIND_LABEL: Record<AgendaEventKind, string> = {
  meeting: "Reunião",
  event: "Evento",
  exam: "Prova",
  holiday: "Feriado / recesso",
  reminder: "Lembrete",
};

export const AUDIENCE_LABEL: Record<AgendaAudience, string> = {
  all: "Todos",
  staff: "Coordenação e professores",
  students: "Alunos",
};

export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  scheduled: "Agendada",
  in_progress: "Em andamento",
  completed: "Concluída",
  cancelled: "Cancelada",
};

export const SESSION_STATUS_TONE: Record<SessionStatus, string> = {
  scheduled: "var(--navy-500)",
  in_progress: "var(--success)",
  completed: "var(--gold-700)",
  cancelled: "var(--muted-foreground)",
};

/**
 * A cor da turma vem da paleta de séries do sistema, na ordem que o
 * repositório já fixou (`colorIndex`, alfabética). Turma que era azul
 * continua azul amanhã — é o que deixa a grade legível sem legenda.
 */
export const GROUP_TONES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
] as const;

/** O que não é aula tem cor por tipo, não por turma. */
export const EVENT_TONES: Record<AgendaEventKind, string> = {
  meeting: "var(--navy-600)",
  event: "var(--gold-500)",
  exam: "var(--destructive)",
  holiday: "var(--success)",
  reminder: "var(--muted-foreground)",
};

/** Mistura um token de cor com transparência — fundo pastel dos cartões. */
export function tint(tone: string, percent: number): string {
  return `color-mix(in srgb, ${tone} ${percent}%, transparent)`;
}

// ------------------------------------------------------------- datas -------

export const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const WEEKDAY_LONG = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Hoje **na escola** — não no relógio de quem abriu a tela. */
export function todayISO(): string {
  return formatInTimeZone(new Date(), SCHOOL_TZ, "yyyy-MM-dd");
}

/** Minutos decorridos do dia, agora, na escola. */
export function nowMinutes(): number {
  const [h, m] = formatInTimeZone(new Date(), SCHOOL_TZ, "HH:mm").split(":");
  return Number(h ?? 0) * 60 + Number(m ?? 0);
}

/**
 * `Date` à meia-noite local só para as contas de calendário (que dia da
 * semana é, quantos dias tem o mês). Nunca sai daqui para a tela.
 */
export function parseDay(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function formatDay(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function addDaysISO(iso: string, days: number): string {
  const date = parseDay(iso);
  date.setDate(date.getDate() + days);
  return formatDay(date);
}

export function addMonthsISO(iso: string, months: number): string {
  const date = parseDay(iso);
  // Dia 31 + 1 mês em fevereiro escorregaria para março; ancorar no dia 1
  // mantém a navegação de mês previsível.
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  return formatDay(date);
}

export function dayOfWeek(iso: string): number {
  return parseDay(iso).getDay();
}

export function dayNumber(iso: string): number {
  return parseDay(iso).getDate();
}

/** Semana (Dom→Sáb) que contém `iso`. */
export function weekOf(iso: string): string[] {
  const start = parseDay(iso);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return formatDay(day);
  });
}

/** Matriz do mês em seis linhas de sete dias — a grade nunca muda de altura. */
export function monthMatrix(iso: string): string[][] {
  const first = parseDay(iso);
  first.setDate(1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => {
      const cell = new Date(start);
      cell.setDate(start.getDate() + week * 7 + day);
      return formatDay(cell);
    }),
  );
}

export function isSameMonth(iso: string, reference: string): boolean {
  return iso.slice(0, 7) === reference.slice(0, 7);
}

export function minutesLabel(minutes: number): string {
  return `${pad2(Math.floor(minutes / 60) % 24)}:${pad2(minutes % 60)}`;
}

export function durationLabel(minutes: number): string {
  if (minutes >= 1440) return "Dia inteiro";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours}h` : `${hours}h${pad2(rest)}`;
}

/** "Sexta-feira, 6 de setembro de 2026". */
export function longDateLabel(iso: string): string {
  const date = parseDay(iso);
  const month = MONTHS[date.getMonth()]?.toLowerCase() ?? "";
  return `${WEEKDAY_LONG[date.getDay()]}, ${date.getDate()} de ${month} de ${date.getFullYear()}`;
}

/** "6 de setembro" — cabeçalhos curtos e painel de detalhe. */
export function shortDateLabel(iso: string): string {
  const date = parseDay(iso);
  return `${date.getDate()} de ${MONTHS[date.getMonth()]?.toLowerCase() ?? ""}`;
}

export function monthLabel(iso: string): string {
  const date = parseDay(iso);
  return `${MONTHS[date.getMonth()]} de ${date.getFullYear()}`;
}

/** O que a barra de navegação escreve ao lado das setas, por vista. */
export function rangeLabel(view: AgendaViewMode, iso: string): string {
  if (view === "dia") return longDateLabel(iso);
  if (view === "semana") {
    const week = weekOf(iso);
    return `${shortDateLabel(week[0] ?? iso)} – ${shortDateLabel(week[6] ?? iso)}`;
  }
  if (view === "mes") return monthLabel(iso);
  return `A partir de ${shortDateLabel(iso)}`;
}

// ------------------------------------------------------- posicionamento ----

export interface PlacedItem {
  item: AgendaItem;
  /** Dia na escola (`yyyy-MM-dd`). */
  day: string;
  startMinutes: number;
  endMinutes: number;
  startLabel: string;
  endLabel: string;
  filterKind: AgendaKindFilter;
}

export function filterKindOf(item: AgendaItem): AgendaKindFilter {
  if (item.kind === "session") return "session";
  if (item.kind === "preview") return "preview";
  return item.eventKind ?? "meeting";
}

/**
 * Converte cada item para o fuso da escola uma vez só. Compromisso que
 * atravessa a meia-noite é aparado no fim do dia: a grade tem 24 linhas, e
 * deixar o cartão vazar mentiria sobre a duração no lugar onde ele começou.
 */
export function placeItems(items: AgendaItem[]): PlacedItem[] {
  return items.map((item) => {
    const at = new Date(item.startsAt);
    const day = formatInTimeZone(at, SCHOOL_TZ, "yyyy-MM-dd");
    const [h, m] = formatInTimeZone(at, SCHOOL_TZ, "HH:mm").split(":");
    const startMinutes = Number(h ?? 0) * 60 + Number(m ?? 0);
    const endMinutes = Math.min(startMinutes + item.durationMinutes, 24 * 60);
    return {
      item,
      day,
      startMinutes,
      endMinutes,
      startLabel: minutesLabel(startMinutes),
      endLabel: minutesLabel(endMinutes),
      filterKind: filterKindOf(item),
    };
  });
}

export interface PositionedItem {
  placed: PlacedItem;
  /** Em px, a partir do topo da grade. */
  top: number;
  height: number;
  leftPercent: number;
  widthPercent: number;
}

/**
 * Distribui em colunas lado a lado o que acontece ao mesmo tempo.
 *
 * O agrupamento é por *encadeamento*: A sobrepõe B, B sobrepõe C, e os três
 * dividem a largura mesmo que A e C não se toquem. É o comportamento que
 * qualquer calendário tem, e o único que não deixa um cartão escondido atrás
 * do outro.
 */
export function layoutDay(
  items: PlacedItem[],
  gridStartMinutes: number,
  pixelsPerMinute: number,
  minimumMinutes: number,
): PositionedItem[] {
  const sorted = [...items].sort(
    (a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes,
  );
  const result: PositionedItem[] = [];

  let cluster: PlacedItem[] = [];
  let clusterEnd = -1;

  const spanOf = (placed: PlacedItem) => ({
    start: placed.startMinutes,
    end: Math.max(placed.endMinutes, placed.startMinutes + minimumMinutes),
  });

  const flush = () => {
    if (cluster.length === 0) return;

    // Fim (em minutos) de cada coluna já aberta — o item cai na primeira que
    // já terminou, e só abre coluna nova quando nenhuma serve.
    const columnEnds: number[] = [];
    const columnOf = new Map<string, number>();

    for (const placed of cluster) {
      const { start, end } = spanOf(placed);
      const free = columnEnds.findIndex((columnEnd) => columnEnd <= start);
      const column = free === -1 ? columnEnds.length : free;
      columnEnds[column] = end;
      columnOf.set(placed.item.key, column);
    }

    const total = columnEnds.length;
    for (const placed of cluster) {
      const { start, end } = spanOf(placed);
      const column = columnOf.get(placed.item.key) ?? 0;
      result.push({
        placed,
        top: (start - gridStartMinutes) * pixelsPerMinute,
        height: (end - start) * pixelsPerMinute,
        widthPercent: 100 / total,
        leftPercent: (100 / total) * column,
      });
    }

    cluster = [];
    clusterEnd = -1;
  };

  for (const placed of sorted) {
    const { start, end } = spanOf(placed);
    if (cluster.length > 0 && start >= clusterEnd) flush();
    cluster.push(placed);
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();

  return result;
}

/**
 * Janela de horas que a grade desenha. Parte do expediente típico da escola e
 * abre o suficiente para caber o que estiver marcado fora dele — uma reunião
 * das 7h não pode ficar acima do topo da tela.
 */
export function gridBounds(items: PlacedItem[]): { start: number; end: number } {
  let start = 7 * 60;
  let end = 22 * 60;
  for (const placed of items) {
    if (placed.item.allDay) continue;
    start = Math.min(start, Math.floor(placed.startMinutes / 60) * 60);
    end = Math.max(end, Math.ceil(placed.endMinutes / 60) * 60);
  }
  return {
    start: Math.max(0, start),
    end: Math.min(24 * 60, Math.max(end, start + 60)),
  };
}
