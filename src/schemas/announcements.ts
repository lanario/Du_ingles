import { z } from "zod";

export const createAnnouncementSchema = z.object({
  scope: z.enum(["school", "group"]),
  groupId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
  title: z.string().trim().min(2, "Informe um título.").max(160),
  body: z.string().trim().min(1, "Escreva a mensagem.").max(2000),
});
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
