import { z } from "zod";

/**
 * A pré-visualização é só da área do aluno. A do professor deixou de ser uma
 * lente do admin quando virou área própria (`/professor`), com o papel de
 * verdade por trás: quem coordena não "vira" professor, e quem dá aula não
 * transita para a área do aluno.
 */
export const enterViewAsSchema = z.object({
  role: z.literal("student"),
  targetUserId: z.string().uuid().optional(),
});
export type EnterViewAsInput = z.infer<typeof enterViewAsSchema>;
