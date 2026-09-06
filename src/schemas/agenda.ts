import { z } from "zod";
import { AGENDA_AUDIENCES, AGENDA_EVENT_KINDS } from "@/types/domain";

/**
 * Compromissos da agenda que não são aula. A aula tem schema próprio
 * (`schemas/lesson-planner.ts`) porque nasce da grade da turma; aqui é o
 * resto do calendário — reunião, prova, evento, recesso.
 *
 * `date` + `time` chegam no fuso da escola, como no planejador: é a action
 * que converte para UTC. Guardar o que a pessoa digitou até o último momento
 * evita que um erro de fuso vire uma reunião marcada três horas antes.
 */

const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data.");
const timeField = z.string().regex(/^\d{2}:\d{2}$/, "Escolha o horário.");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .optional()
    .or(z.literal(""))
    .transform((value) => value || undefined);

/**
 * Turma vazia significa "escola inteira" — e não um campo esquecido. Só a
 * coordenação pode marcar assim; a action é que barra o professor, porque a
 * regra é de papel, não de formato.
 */
const groupField = z
  .string()
  .uuid("Selecione uma turma válida.")
  .optional()
  .or(z.literal(""))
  .transform((value) => value || undefined);

export const agendaEventSchema = z
  .object({
    title: z.string().trim().min(2, "Informe o título do compromisso.").max(160),
    kind: z.enum(AGENDA_EVENT_KINDS as [string, ...string[]]).default("meeting"),
    audience: z.enum(AGENDA_AUDIENCES as [string, ...string[]]).default("all"),
    groupId: groupField,
    date: dateField,
    time: timeField,
    durationMinutes: z.coerce
      .number()
      .int()
      .min(5, "Mínimo de 5 minutos.")
      .max(1440, "Máximo de 24 horas.")
      .default(60),
    allDay: z
      .union([z.literal("true"), z.literal("false"), z.literal("on"), z.boolean()])
      .optional()
      .transform((value) => value === true || value === "true" || value === "on"),
    location: optionalText(160),
    description: optionalText(2000),
  })
  /**
   * Dia inteiro não tem hora útil: a interface esconde os campos, e aqui o
   * valor é normalizado para 00:00–24h. Sem isso, um evento marcado como
   * "dia inteiro" às 14:00 desenharia uma faixa de uma hora à tarde.
   */
  .transform((value) =>
    value.allDay
      ? { ...value, time: "00:00", durationMinutes: 1440 }
      : value,
  );
export type AgendaEventInput = z.infer<typeof agendaEventSchema>;

export const updateAgendaEventSchema = z.object({ id: z.string().uuid() });
