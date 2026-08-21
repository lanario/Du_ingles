import type { SessionStatus } from "@/types/domain";

/** Rótulos e formatação compartilhados pelas telas do planejador. */

export const TZ = "America/Sao_Paulo";

export const LEVEL_HINT: Record<string, string> = {
  A1: "Iniciante",
  A2: "Básico",
  B1: "Intermediário",
  B2: "Intermediário superior",
  C1: "Avançado",
  C2: "Proficiente",
};

export const STATUS_META: Record<
  SessionStatus,
  { label: string; className: string; dot: string }
> = {
  scheduled: {
    label: "Agendada",
    className: "border-navy-100 bg-navy-50 text-navy-800",
    dot: "bg-navy-500",
  },
  in_progress: {
    label: "Ao vivo",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-[var(--success)]",
  },
  completed: {
    label: "Concluída",
    className: "border-admin-border bg-admin-muted text-admin-foreground/70",
    dot: "bg-admin-foreground/40",
  },
  cancelled: {
    label: "Cancelada",
    className: "border-red-200 bg-red-50 text-red-700",
    dot: "bg-red-500",
  },
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  day: "2-digit",
  month: "short",
});

const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  weekday: "long",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
});

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function formatTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

export function formatDay(iso: string): string {
  return dateFormatter.format(new Date(iso)).replace(".", "");
}

export function formatWeekday(iso: string): string {
  return weekdayFormatter.format(new Date(iso));
}

/** `YYYY-MM-DD` no fuso da escola — chave de agrupamento da agenda. */
export function dayKey(iso: string): string {
  return dayKeyFormatter.format(new Date(iso));
}

export function todayKey(): string {
  return dayKeyFormatter.format(new Date());
}

/** "há 2 dias", "em 3 h" — leitura rápida na lista de planos. */
export function relativeFrom(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);
  const past = minutes >= 0;
  const value = Math.abs(minutes);

  if (value < 1) return "agora";
  if (value < 60) return past ? `há ${value} min` : `em ${value} min`;

  const hours = Math.round(value / 60);
  if (hours < 24) return past ? `há ${hours} h` : `em ${hours} h`;

  const days = Math.round(hours / 24);
  if (days < 30) return past ? `há ${days} d` : `em ${days} d`;

  const months = Math.round(days / 30);
  return past ? `há ${months} m` : `em ${months} m`;
}

export function isLive(status: SessionStatus): boolean {
  return status === "in_progress";
}

/** Campos `date`/`time` do formulário, no fuso da escola. */
export function toFormParts(iso: string): { date: string; time: string } {
  return { date: dayKey(iso), time: formatTime(iso) };
}

export function defaultScheduleParts(): { date: string; time: string } {
  const now = new Date(Date.now() + 60 * 60 * 1000);
  const time = timeFormatter.format(now);
  return { date: dayKeyFormatter.format(now), time: `${time.slice(0, 2)}:00` };
}
