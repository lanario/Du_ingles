import { z } from "zod";
import { CEFR_LEVELS } from "@/types/domain";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const scheduleEntrySchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    start: z.string().regex(timeRegex, "Horário inválido."),
    end: z.string().regex(timeRegex, "Horário inválido."),
  })
  .refine((e) => e.end > e.start, {
    message: "O horário final deve ser depois do inicial.",
  });
export type ScheduleEntry = z.infer<typeof scheduleEntrySchema>;

export const createGroupSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da turma.").max(160),
  courseId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
  teacherId: z.string().uuid("Selecione um professor."),
  level: z.enum(CEFR_LEVELS as [string, ...string[]]),
  maxStudents: z.coerce.number().int().min(1).max(100).default(12),
  startDate: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  endDate: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  schedule: z.string().transform((v, ctx) => {
    try {
      const parsed = JSON.parse(v) as unknown;
      const result = z
        .array(scheduleEntrySchema)
        .min(1, "Adicione ao menos um horário.")
        .safeParse(parsed);
      if (!result.success) {
        ctx.addIssue({ code: "custom", message: "Horários inválidos." });
        return z.NEVER;
      }
      return result.data;
    } catch {
      ctx.addIssue({ code: "custom", message: "Adicione ao menos um horário." });
      return z.NEVER;
    }
  }),
});
export type CreateGroupInput = z.infer<typeof createGroupSchema>;
