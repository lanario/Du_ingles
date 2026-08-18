import { z } from "zod";

export const createAssignmentSchema = z.object({
  groupId: z.string().uuid("Selecione uma turma."),
  title: z.string().trim().min(2, "Informe o título.").max(200),
  dueAt: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  maxScore: z.coerce.number().min(0).max(1000).default(10),
});
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;

export const submitAssignmentSchema = z.object({
  content: z.string().trim().min(1, "Escreva sua resposta."),
});
export type SubmitAssignmentInput = z.infer<typeof submitAssignmentSchema>;

export const gradeSubmissionSchema = z.object({
  score: z.coerce.number().min(0).max(1000),
  feedback: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => v || undefined),
});
export type GradeSubmissionInput = z.infer<typeof gradeSubmissionSchema>;
