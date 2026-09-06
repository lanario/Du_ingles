/**
 * Prévia da agenda — o mês que a grade da turma *desenha*, não o que já foi
 * marcado.
 *
 * O banco guarda só a próxima aula de cada turma (ver a migration
 * `0035_next_session_only.sql`): é o professor que confirma a seguinte ao
 * encerrar a anterior. Sem isto o aluno abriria a agenda e veria uma linha
 * só, como se a turma fosse acabar na semana que vem. Então as datas
 * seguintes são CALCULADAS aqui e mostradas como previsão, com a cara de
 * previsão — nada disto existe no banco e nada disto está prometido.
 *
 * Módulo puro: roda no servidor (páginas) e no cliente (cartões da agenda).
 */

import { fromZonedTime } from "date-fns-tz";

/** Fuso da escola. As horas da grade são locais, não UTC. */
export const SCHOOL_TZ = "America/Sao_Paulo";

/** Uma faixa da grade semanal: `weekday` no padrão de `Date.getDay()` (0 = domingo). */
export interface SchedulePattern {
  weekday: number;
  start: string;
  end: string;
}

export interface ProjectedSession {
  /** `group-<id>-<iso>` — chave estável de lista, já que não há id de banco. */
  key: string;
  scheduledAt: string;
  durationMinutes: number;
}

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SCHOOL_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** `YYYY-MM-DD` no fuso da escola — o dia como a escola o vê. */
export function schoolDayKey(date: Date = new Date()): string {
  return dayKeyFormatter.format(date);
}

/**
 * Meio-dia UTC de propósito: é a âncora que sobrevive a somar dias sem que
 * um horário de verão (ou o fuso de quem roda o código) empurre a data para
 * o dia anterior.
 */
function anchor(dayKey: string): Date {
  return new Date(`${dayKey}T12:00:00Z`);
}

function addDays(dayKey: string, days: number): string {
  const next = anchor(dayKey);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function weekdayOf(dayKey: string): number {
  return anchor(dayKey).getUTCDay();
}

function minutesBetween(start: string, end: string): number {
  const [sh = 0, sm = 0] = start.split(":").map(Number);
  const [eh = 0, em = 0] = end.split(":").map(Number);
  return Math.max(eh * 60 + em - (sh * 60 + sm), 1);
}

export interface ProjectOptions {
  schedule: SchedulePattern[];
  /** Período da turma, quando definido — a prévia não passa dele. */
  startDate?: string | null;
  endDate?: string | null;
  /** A partir de quando projetar. Padrão: agora. */
  from?: Date;
  /** Tamanho da janela em dias. Padrão: 35 (o mês que o aluno quer ver). */
  days?: number;
  /** Datas ISO que JÁ existem como sessão — não viram prévia de novo. */
  exclude?: string[];
  limit?: number;
  /** Prefixo da chave de lista, para não colidir entre turmas. */
  keyPrefix?: string;
}

/**
 * Projeta as ocorrências da grade dentro da janela, em ordem, tirando as que
 * já viraram sessão de verdade.
 */
export function projectSessions({
  schedule,
  startDate,
  endDate,
  from = new Date(),
  days = 35,
  exclude = [],
  limit = 24,
  keyPrefix = "preview",
}: ProjectOptions): ProjectedSession[] {
  if (!Array.isArray(schedule) || schedule.length === 0) return [];

  // Comparação por instante, não por texto: `scheduled_at` volta do Postgres
  // com fuso ("+00:00") e o ISO montado aqui termina em "Z".
  const taken = new Set(
    exclude.map((iso) => new Date(iso).getTime()).filter((time) => !Number.isNaN(time)),
  );

  const out: ProjectedSession[] = [];
  const startKey = schoolDayKey(from);

  for (let offset = 0; offset <= days; offset += 1) {
    const dayKey = addDays(startKey, offset);
    if (startDate && dayKey < startDate) continue;
    if (endDate && dayKey > endDate) break;

    const weekday = weekdayOf(dayKey);

    for (const entry of schedule) {
      if (entry?.weekday !== weekday) continue;

      const at = fromZonedTime(`${dayKey}T${entry.start}:00`, SCHOOL_TZ);
      if (at.getTime() <= from.getTime()) continue;
      if (taken.has(at.getTime())) continue;

      const iso = at.toISOString();
      out.push({
        key: `${keyPrefix}-${iso}`,
        scheduledAt: iso,
        durationMinutes: minutesBetween(entry.start, entry.end),
      });
    }
  }

  return out.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)).slice(0, limit);
}

/**
 * A próxima data que a grade pede depois de uma aula — o que o formulário de
 * "marcar a próxima" já vem preenchido. Turma de duas faixas (domingo e
 * quinta) sugere a quinta; turma de uma faixa sugere a mesma hora na semana
 * seguinte, que é como o professor pensa.
 */
export function suggestNextSlot(options: {
  schedule: SchedulePattern[];
  startDate?: string | null;
  endDate?: string | null;
  /** Aula que acabou de ser dada. */
  after: Date;
  durationMinutes: number;
  exclude?: string[];
}): { scheduledAt: string; durationMinutes: number } {
  const [next] = projectSessions({
    schedule: options.schedule,
    startDate: options.startDate,
    endDate: options.endDate,
    from: options.after,
    days: 60,
    exclude: options.exclude,
    limit: 1,
  });

  if (next) return next;

  // Sem grade (ou fora do período): mesma hora, semana que vem.
  const fallback = new Date(options.after.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    scheduledAt: fallback.toISOString(),
    durationMinutes: options.durationMinutes,
  };
}
