/**
 * Vocabulário compartilhado da área de turmas: o formato que a página entrega
 * à `TurmasView`, os derivados que cartão, lista e barra de filtros mostram e
 * a busca local.
 *
 * Iniciais, tom de avatar e formatação de data vêm de `users-utils`; o tom de
 * cada nível CEFR vem de `students-utils` — o mesmo vocabulário das outras
 * áreas do painel, sem duplicar.
 */

import type { GroupDetail } from "@/repositories/groups";
import type { ScheduleEntry } from "@/schemas/groups";

export { formatDate, initialsOf, toneOf } from "@/components/features/admin/users/users-utils";
export { CEFR_LEVELS_ORDER, CEFR_TONE } from "@/components/features/admin/students/students-utils";

/** A turma como a área de admin a consome — a projeção completa do repositório. */
export type Group = GroupDetail;

export type StatusFilter = "all" | "active" | "inactive";

/** Professor selecionado na barra: todos ou um responsável específico. */
export type TeacherFilter = { type: "all" } | { type: "teacher"; id: string };

/** Ordenação da lista — o admin escolhe o que quer no topo. */
export type SortMode = "name" | "occupancy" | "students";

export const SORT_LABEL: Record<SortMode, string> = {
  name: "Nome (A–Z)",
  occupancy: "Mais lotadas",
  students: "Mais alunos",
};

export const WEEKDAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const WEEKDAY_LONG = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

/** Grade semanal na ordem do calendário — o banco guarda na ordem de digitação. */
export function sortedSchedule(schedule: ScheduleEntry[]): ScheduleEntry[] {
  return [...schedule].sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start));
}

/** "seg 19:00–20:30 · qua 19:00–20:30" — resumo de uma linha da grade. */
export function scheduleSummary(schedule: ScheduleEntry[]): string {
  if (schedule.length === 0) return "Sem horários definidos";
  return sortedSchedule(schedule)
    .map((entry) => `${WEEKDAY_SHORT[entry.weekday]} ${entry.start}–${entry.end}`)
    .join(" · ");
}

/** Minutos semanais de aula — a "carga" da turma, mostrada no detalhe. */
export function weeklyMinutes(schedule: ScheduleEntry[]): number {
  return schedule.reduce((total, entry) => {
    const [sh = 0, sm = 0] = entry.start.split(":").map(Number);
    const [eh = 0, em = 0] = entry.end.split(":").map(Number);
    return total + Math.max(0, eh * 60 + em - (sh * 60 + sm));
  }, 0);
}

export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return "—";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h${String(rest).padStart(2, "0")}`;
}

/** Fração de lotação, limitada a 1 — turma estourada não vira barra de 130%. */
export function occupancyRatio(group: Group): number {
  if (group.maxStudents <= 0) return 0;
  return Math.min(group.enrolledCount / group.maxStudents, 1);
}

export function seatsLeft(group: Group): number {
  return Math.max(0, group.maxStudents - group.enrolledCount);
}

/**
 * Tom da lotação, na mesma progressão dos gráficos do painel: vazia é neutra,
 * enchendo passa por azul e dourado, lotada fecha em verde — "não cabe mais
 * ninguém" é o estado bom de uma turma, não um alerta.
 */
export function occupancyTone(group: Group): string {
  if (group.enrolledCount === 0) return "var(--muted-foreground)";
  const ratio = occupancyRatio(group);
  if (ratio >= 1) return "var(--success)";
  if (ratio >= 0.6) return "var(--gold-600)";
  return "var(--navy-500)";
}

export function occupancyLabel(group: Group): string {
  if (group.enrolledCount === 0) return "Turma vazia";
  const left = seatsLeft(group);
  if (left === 0) return "Turma lotada";
  return `${left} ${left === 1 ? "vaga" : "vagas"}`;
}

/** "12 mar 2026 → 30 nov 2026", com as pontas abertas quando não há data. */
export function periodLabel(group: Group): string | null {
  const format = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  if (group.startDate && group.endDate) return `${format(group.startDate)} → ${format(group.endDate)}`;
  if (group.startDate) return `A partir de ${format(group.startDate)}`;
  if (group.endDate) return `Até ${format(group.endDate)}`;
  return null;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Busca por nome, professor, curso, nível, status ou dia da semana. */
export function groupMatches(group: Group, term: string): boolean {
  const target = normalize(term).trim();
  if (target === "") return true;

  const weekdays = group.schedule.map((entry) => WEEKDAY_LONG[entry.weekday] ?? "");

  return [
    group.name,
    group.teacherName,
    group.courseName ?? "",
    group.level,
    group.isActive ? "ativa" : "inativa",
    ...weekdays,
  ].some((field) => normalize(field).includes(target));
}

export function sortGroups(groups: Group[], mode: SortMode): Group[] {
  const sorted = [...groups];
  if (mode === "name") {
    sorted.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  } else if (mode === "students") {
    sorted.sort((a, b) => b.enrolledCount - a.enrolledCount || a.name.localeCompare(b.name, "pt-BR"));
  } else {
    sorted.sort(
      (a, b) => occupancyRatio(b) - occupancyRatio(a) || a.name.localeCompare(b.name, "pt-BR"),
    );
  }
  return sorted;
}

export interface TeacherBucket {
  id: string;
  name: string;
  count: number;
}

/** Professores presentes nas turmas, com quantas cada um responde. */
export function teacherBuckets(groups: Group[]): TeacherBucket[] {
  const byId = new Map<string, TeacherBucket>();
  for (const group of groups) {
    if (!group.teacherId) continue;
    const bucket = byId.get(group.teacherId);
    if (bucket) bucket.count += 1;
    else byId.set(group.teacherId, { id: group.teacherId, name: group.teacherName, count: 1 });
  }
  return [...byId.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));
}
