import { z } from "zod";

export const createEnrollmentSchema = z.object({
  studentId: z.string().uuid("Selecione um aluno."),
});
export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>;

export const transferEnrollmentSchema = z.object({
  enrollmentId: z.string().uuid("Selecione uma matricula."),
  toGroupId: z.string().uuid("Selecione a turma de destino."),
});
export type TransferEnrollmentInput = z.infer<typeof transferEnrollmentSchema>;

export const groupChangeRequestSchema = z.object({
  enrollmentId: z.string().uuid("Selecione a turma atual."),
  toGroupId: z.string().uuid("Selecione a turma desejada."),
  reason: z.string().trim().max(500, "Maximo de 500 caracteres.").optional(),
});
export type GroupChangeRequestInput = z.infer<typeof groupChangeRequestSchema>;
