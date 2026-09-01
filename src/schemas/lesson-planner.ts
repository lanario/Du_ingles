import { z } from "zod";
import { CEFR_LEVELS } from "@/types/domain";

/**
 * Planejador de aulas (área admin). Reaproveita as tabelas `lesson_plans` e
 * `class_sessions` — o que muda aqui é o alcance: o admin planeja para a
 * escola inteira, então turma e professor entram como campos do formulário
 * em vez de virem implícitos de quem está logado.
 */

/**
 * Campo opcional vindo de formulário. `formData.get(nome)` devolve `null` —
 * e não `undefined` — quando o input não está montado na tela, que é o caso
 * normal de um campo escondido atrás de um "trocar". Um `.optional()` sozinho
 * recusa esse `null` ("expected string, received null") e reprova o
 * formulário inteiro por um campo que o usuário nem viu; daí `.nullish()`.
 */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || undefined);

const optionalUuid = z
  .string()
  .trim()
  .nullish()
  .transform((value) => value || undefined)
  .pipe(z.string().uuid().optional());

export const plannerPlanSchema = z.object({
  title: z.string().trim().min(2, "Informe o título da aula.").max(200),
  summary: optionalText(500),
  level: z.enum(CEFR_LEVELS as [string, ...string[]]),
  durationMinutes: z.coerce.number().int().min(15).max(240).default(60),
  isShared: z.coerce.boolean().default(false),
});
export type PlannerPlanInput = z.infer<typeof plannerPlanSchema>;

export const plannerContentSchema = z.object({
  content: z.string().min(1, "Conteúdo vazio."),
});

/** `date` + `time` no fuso da escola; a action converte para UTC. */
export const schedulePlannerSessionSchema = z.object({
  groupId: z.string().uuid("Escolha a turma."),
  lessonPlanId: optionalUuid,
  teacherId: optionalUuid,
  title: z.string().trim().min(2, "Informe o título da aula.").max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Escolha o horário."),
  durationMinutes: z.coerce.number().int().min(15).max(240).default(60),
});
export type SchedulePlannerSessionInput = z.infer<typeof schedulePlannerSessionSchema>;

export const rescheduleSessionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Escolha o horário."),
  durationMinutes: z.coerce.number().int().min(15).max(240),
});
export type RescheduleSessionInput = z.infer<typeof rescheduleSessionSchema>;
