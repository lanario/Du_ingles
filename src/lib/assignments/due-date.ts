/**
 * Prazo de entrega: o dia que o professor escolhe vs. o instante que o banco
 * guarda.
 *
 * O campo do formulário é um dia solto (`yyyy-mm-dd`) — sem hora e sem fuso.
 * `assignments.due_at` é `timestamptz`, então alguém precisa decidir o
 * instante. Enquanto essa decisão não era tomada aqui, a string crua ia para o
 * Postgres e virava MEIA-NOITE UTC: prazo marcado para 15/09 voltava como
 * `2025-09-15T00:00:00Z`, que em São Paulo é 14/09 às 21h. O aluno recebia a
 * tarefa com um dia a menos — e ela já nascia atrasada às 21h da véspera,
 * porque `derivedStatus` compara esse instante com "agora".
 *
 * A âncora certa é o FIM do dia escolhido, no fuso da escola: "até 15/09"
 * quer dizer "até 15/09 às 23:59". Assim a data lida de volta é sempre a que
 * o professor marcou e o atraso só começa quando o dia realmente acaba.
 */

import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { SCHOOL_TZ } from "@/lib/schedule/session-preview";

const DAY_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `yyyy-mm-dd` (o que o `DateField` envia) → ISO do fim daquele dia em São
 * Paulo. Qualquer outra coisa passa intacta: valor que já veio com hora foi
 * escolhido por alguém e não é papel daqui remexer.
 */
export function dueDateToInstant(value: string): string {
  if (!DAY_ONLY.test(value)) return value;
  return fromZonedTime(`${value}T23:59:59`, SCHOOL_TZ).toISOString();
}

/**
 * `15/09/2025` — o prazo como a escola o lê. Sempre no fuso da escola, nunca
 * no do servidor: em produção ele roda em UTC e o fim do dia cairia no dia
 * seguinte.
 */
export function formatDueDate(iso: string): string {
  const stamp = new Date(iso);
  if (Number.isNaN(stamp.getTime())) return "";
  return formatInTimeZone(stamp, SCHOOL_TZ, "dd/MM/yyyy");
}
