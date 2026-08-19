/**
 * Vocabulário compartilhado da área de alunos: o formato que a página entrega
 * à `StudentsView` e os derivados que cartão, lista e barra de turmas
 * precisam mostrar. Iniciais, tom do avatar e formatação de data vêm de
 * `users-utils` — o mesmo vocabulário da área de Usuários, sem duplicar.
 */

import type { GroupListItem } from "@/repositories/groups";
import type { StudentListItem } from "@/repositories/students";
import type { CefrLevel } from "@/types/domain";

export { formatDate, initialsOf, toneOf } from "@/components/features/admin/users/users-utils";

/** Aluno com o nome e o nível da turma já resolvidos (a página faz o merge). */
export interface Student extends StudentListItem {
  groupName: string | null;
  groupLevel: CefrLevel | null;
}

export type StatusFilter = "all" | "active" | "inactive";

/**
 * Turma selecionada na barra: todas, uma turma específica (o id) ou só os
 * alunos sem matrícula ativa.
 */
export type GroupFilter = { type: "all" } | { type: "none" } | { type: "group"; id: string };

export const CEFR_LEVELS_ORDER: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

/**
 * Tom de cada nível — a mesma progressão azul → dourado usada nos gráficos do
 * painel (`--chart-1` a `--chart-6`), do iniciante ao avançado.
 */
export const CEFR_TONE: Record<CefrLevel, string> = {
  A1: "var(--navy-300)",
  A2: "var(--navy-500)",
  B1: "var(--navy-800)",
  C1: "var(--gold-700)",
  B2: "var(--gold-600)",
  C2: "var(--gold-500)",
};

export function joinGroups(students: StudentListItem[], groups: GroupListItem[]): Student[] {
  const groupById = new Map(groups.map((group) => [group.id, group]));

  return students.map((student) => {
    const group = student.enrollment ? groupById.get(student.enrollment.groupId) : undefined;
    return {
      ...student,
      groupName: group?.name ?? null,
      groupLevel: group?.level ?? null,
    };
  });
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Busca por nome, e-mail, responsável, turma, nível ou status. */
export function studentMatches(student: Student, term: string): boolean {
  const target = normalize(term).trim();
  if (target === "") return true;

  return [
    student.fullName,
    student.email,
    student.guardianName ?? "",
    student.groupName ?? "",
    student.currentLevel,
    student.isActive ? "ativo" : "inativo",
  ].some((field) => normalize(field).includes(target));
}
