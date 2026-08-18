import { z } from "zod";
import { CEFR_LEVELS } from "@/types/domain";

export const createCourseSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do curso.").max(160),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => v || undefined),
  level: z.enum(CEFR_LEVELS as [string, ...string[]]),
  totalHours: z.coerce.number().int().positive().optional(),
});
export type CreateCourseInput = z.infer<typeof createCourseSchema>;
