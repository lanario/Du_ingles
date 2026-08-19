/**
 * Vocabulário compartilhado da área de usuários: rótulos de papel, o tom de
 * cada pessoa nos avatares e os derivados que os cartões mostram (iniciais,
 * datas, busca local).
 */

import type { UserListItem } from "@/repositories/users";
import type { AppRole } from "@/types/domain";

export type RoleFilter = AppRole | "all";

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin",
  teacher: "Professor",
  student: "Aluno",
};

export const ROLE_PLURAL: Record<AppRole, string> = {
  admin: "Admins",
  teacher: "Professores",
  student: "Alunos",
};

export const ROLE_DESCRIPTION: Record<AppRole, string> = {
  admin: "Gerencia turmas, cadastros, financeiro e a própria equipe.",
  teacher: "Conduz aulas, planos, tarefas e a frequência das turmas.",
  student: "Acompanha aulas, tarefas e o próprio progresso.",
};

/**
 * Cor de cada papel dentro da paleta institucional: o azul marinho fechado é
 * o admin, o dourado é o professor e o azul claro é o aluno. Duas famílias de
 * cor apenas — a hierarquia aparece pela profundidade, não por cores novas.
 */
export const ROLE_TONE: Record<AppRole, string> = {
  admin: "var(--navy-800)",
  teacher: "var(--gold-700)",
  student: "var(--navy-500)",
};

/**
 * A hierarquia aparece na ordem da grade: admins abrem a lista, professores
 * vêm em seguida e alunos fecham. Dentro do mesmo papel vale a ordem que o
 * banco já devolve (entrada mais recente primeiro).
 */
const ROLE_ORDER: Record<AppRole, number> = { admin: 0, teacher: 1, student: 2 };

export function byHierarchy(a: UserListItem, b: UserListItem): number {
  return (ROLE_ORDER[a.role] ?? 3) - (ROLE_ORDER[b.role] ?? 3);
}

/**
 * Paleta dos avatares — tons calibrados para o canvas claro do painel: todos
 * têm contraste suficiente sobre branco e nenhum compete com o dourado do
 * acento. O tom sai de um hash da chave, então a mesma pessoa mantém a mesma
 * cor em qualquer ordem de lista.
 */
const TONES = [
  "#0f2c5c",
  "#8a6d1b",
  "#0f7a5a",
  "#1c4c95",
  "#a1442a",
  "#5b3a97",
  "#0e6b7a",
  "#96306b",
] as const;

export function toneOf(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return TONES[hash % TONES.length] ?? TONES[0];
}

/**
 * Iniciais de um nome ou de um e-mail. Para e-mail só conta a parte antes do
 * `@`, e pontos/hífens/underscores valem como espaço ("ana.souza" → "AS").
 */
export function initialsOf(value: string): string {
  const base = (value.includes("@") ? value.split("@")[0] : value) ?? "";
  const parts = base
    .split(/[\s._-]+/)
    .map((part) => part.replace(/\d+/g, ""))
    .filter(Boolean);

  if (parts.length === 0) return value.trim().slice(0, 1).toUpperCase() || "?";

  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Busca por nome, e-mail, papel ou status — tudo em memória, sem ida ao banco. */
export function userMatches(user: UserListItem, term: string): boolean {
  const target = normalize(term).trim();
  if (target === "") return true;

  return [
    user.fullName,
    user.email,
    ROLE_LABEL[user.role],
    user.isActive ? "ativo" : "inativo",
  ].some((field) => normalize(field).includes(target));
}
