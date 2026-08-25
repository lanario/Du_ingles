import "server-only";
import { revalidatePath } from "next/cache";
import { STAFF_BASES } from "@/lib/areas";

/**
 * Revalida o mesmo caminho nas duas áreas da equipe. Uma turma editada pelo
 * professor também mudou para a coordenação — revalidar só o prefixo de quem
 * escreveu deixaria a outra área servindo cache velho.
 *
 * `suffix` é o trecho depois do prefixo, com a barra: `"/turmas"`.
 */
export function revalidateStaffPath(suffix: string): void {
  for (const base of STAFF_BASES) revalidatePath(`${base}${suffix}`);
}
