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
  /** Pasta do ateliê. Ausente = a aula fica solta, fora de qualquer pasta. */
  folderId: optionalUuid,
});
export type PlannerPlanInput = z.infer<typeof plannerPlanSchema>;

/**
 * Pastas do ateliê. São a estante pessoal de quem cria — "compartilhadas" e
 * "privadas" continuam sendo filtro sobre `isShared`/autoria, não pasta.
 */
export const PLANNER_FOLDER_COLORS = [
  "gold",
  "navy",
  "emerald",
  "violet",
  "rose",
  "slate",
] as const;
export type PlannerFolderColor = (typeof PLANNER_FOLDER_COLORS)[number];

export const plannerFolderSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome à pasta.").max(60),
  color: z.enum(PLANNER_FOLDER_COLORS).default("gold"),
});
export type PlannerFolderInput = z.infer<typeof plannerFolderSchema>;

/** Mover aula: `null` tira da pasta, sem apagar nada. */
export const movePlannerPlanSchema = z.object({
  folderId: z.string().uuid().nullable(),
});

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

/**
 * Editar a aula agendada. O título entra opcional porque a mesma tela serve
 * ao "só mudei a hora" da agenda e ao "renomeei o tema" da turma — quando
 * não vem, o título fica como está.
 */
export const rescheduleSessionSchema = z.object({
  title: optionalText(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Escolha o horário."),
  durationMinutes: z.coerce.number().int().min(15).max(240),
});
export type RescheduleSessionInput = z.infer<typeof rescheduleSessionSchema>;

/**
 * A aula seguinte, perguntada a quem acabou de encerrar a anterior. Mesma
 * matéria-prima de `schedulePlannerSessionSchema` sem turma nem professor:
 * os dois vêm da aula que terminou.
 */
export const nextSessionSchema = z.object({
  title: z.string().trim().min(2, "Informe o título da próxima aula.").max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha a data."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Escolha o horário."),
  durationMinutes: z.coerce.number().int().min(15).max(240).default(60),
  lessonPlanId: optionalUuid,
  /** Vira `teacher_notes` da nova aula — lembrete privado do professor. */
  notes: optionalText(1000),
});
export type NextSessionInput = z.infer<typeof nextSessionSchema>;

/**
 * Link da gravação da aula.
 *
 * String vazia é apagar o link, não erro de validação — é assim que o
 * professor remove uma gravação que subiu errada, sem precisar de um segundo
 * botão. Fora isso, só `https`: o campo vira um `<a href>` na tela do aluno,
 * e aceitar qualquer esquema aqui seria abrir a porta para `javascript:`.
 */
export const sessionRecordingSchema = z.object({
  recordingUrl: z
    .string()
    .trim()
    .max(2048, "Link muito longo.")
    .refine((value) => {
      if (value.length === 0) return true;
      try {
        return new URL(value).protocol === "https:";
      } catch {
        return false;
      }
    }, "Cole um link https válido — o endereço que o Google Meet gerou para a gravação."),
});
export type SessionRecordingInput = z.infer<typeof sessionRecordingSchema>;
