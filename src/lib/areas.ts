/**
 * As duas áreas de trabalho da equipe compartilham as MESMAS telas (turmas,
 * alunos, planejador, mensagens) sob prefixos diferentes: `/admin` para a
 * coordenação e `/professor` para quem dá aula. Os componentes montam os
 * links a partir daqui (via `useArea`), nunca com o prefixo escrito à mão —
 * senão a mesma tela levaria o professor para dentro do painel do admin.
 *
 * Módulo puro de propósito: é importado por componentes de cliente e por
 * actions. O que depende de `next/cache` mora em `areas.server.ts`.
 */

export const ADMIN_BASE = "/admin";
export const TEACHER_BASE = "/professor";

/** Prefixos das duas áreas — o que uma escrita precisa revalidar nas duas. */
export const STAFF_BASES = [ADMIN_BASE, TEACHER_BASE] as const;
