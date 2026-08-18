import { z } from "zod";

export const createLeadSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(120),
  email: z.string().trim().min(1, "Informe o e-mail.").email("E-mail inválido."),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((v) => (v ? v : undefined)),
  message: z.string().trim().max(2000).optional(),
});
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
