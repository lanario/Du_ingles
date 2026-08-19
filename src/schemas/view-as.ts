import { z } from "zod";

/**
 * O admin pode pré-visualizar tanto a área do professor quanto a do aluno,
 * então o papel-alvo faz parte do input (antes era sempre `teacher`).
 */
export const enterViewAsSchema = z.object({
  role: z.enum(["teacher", "student"]),
  targetUserId: z.string().uuid().optional(),
});
export type EnterViewAsInput = z.infer<typeof enterViewAsSchema>;
