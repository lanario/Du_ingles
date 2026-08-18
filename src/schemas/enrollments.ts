import { z } from "zod";

export const createEnrollmentSchema = z.object({
  studentId: z.string().uuid("Selecione um aluno."),
});
export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>;
