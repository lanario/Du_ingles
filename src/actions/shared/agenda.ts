"use server";

import { requireRole } from "@/lib/auth/session";
import { getAgenda, type AgendaData } from "@/repositories/agenda";

/**
 * Carregar outra janela de tempo da agenda sem sair da tela.
 *
 * A página entrega o mês passado e os quatro seguintes (o padrão do
 * repositório). Quem navega além disso — planejar o segundo semestre, rever
 * março — cai num vazio que não é vazio de verdade. Esta action busca a
 * janela pedida e devolve a agenda inteira já recortada pelo papel de quem
 * chamou: é o mesmo `getAgenda` da página, então o corte de leitura é o
 * mesmo. Não há atalho de permissão aqui.
 *
 * O aluno também chama (ele navega no calendário como todo mundo); o que ele
 * não tem é qualquer action de escrita.
 */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T/;
/** Teto da janela: dois anos por requisição. */
const MAX_WINDOW_MS = 730 * 24 * 3600_000;

export async function loadAgendaWindowAction(
  from: string,
  to: string,
): Promise<AgendaData | null> {
  const ctx = await requireRole(["admin", "teacher", "student"]);

  if (!ISO_INSTANT.test(from) || !ISO_INSTANT.test(to)) return null;

  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (end <= start || end.getTime() - start.getTime() > MAX_WINDOW_MS) return null;

  return getAgenda(ctx, { from: start.toISOString(), to: end.toISOString() });
}
