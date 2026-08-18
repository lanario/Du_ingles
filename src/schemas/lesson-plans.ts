import { z } from "zod";
import { CEFR_LEVELS } from "@/types/domain";

export const createLessonPlanSchema = z.object({
  title: z.string().trim().min(2, "Informe o título.").max(200),
  summary: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => v || undefined),
  level: z.enum(CEFR_LEVELS as [string, ...string[]]),
  durationMinutes: z.coerce.number().int().min(15).max(240).default(60),
});
export type CreateLessonPlanInput = z.infer<typeof createLessonPlanSchema>;

export const updateLessonPlanContentSchema = z.object({
  content: z.string().min(1, "Conteúdo vazio."),
});
export type UpdateLessonPlanContentInput = z.infer<typeof updateLessonPlanContentSchema>;

export const updateLessonPlanMetaSchema = z.object({
  title: z.string().trim().min(2, "Informe o título.").max(200),
  summary: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => v || undefined),
  level: z.enum(CEFR_LEVELS as [string, ...string[]]),
  durationMinutes: z.coerce.number().int().min(15).max(240),
  isShared: z.coerce.boolean().default(false),
});
export type UpdateLessonPlanMetaInput = z.infer<typeof updateLessonPlanMetaSchema>;
