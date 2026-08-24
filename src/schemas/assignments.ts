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

/**
 * Variante do admin no planejador: a mesma tarefa pode ir para várias turmas
 * de uma vez — vira uma linha em `assignments` por turma selecionada.
 */
export const createPlannerAssignmentSchema = z.object({
  groupIds: z
    .array(z.string().uuid())
    .min(1, "Selecione ao menos uma turma."),
  title: z.string().trim().min(2, "Informe o título.").max(200),
  instructions: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .transform((v) => v || undefined),
  dueAt: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  maxScore: z.coerce.number().min(0).max(1000).default(10),
});
export type CreatePlannerAssignmentInput = z.infer<typeof createPlannerAssignmentSchema>;

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
