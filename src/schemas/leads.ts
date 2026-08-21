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

// ---------------------------------------------------------------------------
// Aula experimental
// ---------------------------------------------------------------------------

/**
 * Formulário da aula experimental. É um lead como qualquer outro — cai na
 * mesma tabela `leads` —, mas pede o que a coordenação precisa para ligar de
 * volta e já agendar: telefone obrigatório e a confirmação de maioridade
 * (menores exigem falar com o responsável antes de marcar).
 *
 * `goal` é o único campo opcional; o resto trava o envio.
 */
export const trialClassSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe seu nome.")
    .max(120)
    .refine((v) => v.split(/\s+/).length >= 2, "Informe nome e sobrenome."),
  email: z.string().trim().min(1, "Informe o e-mail.").email("E-mail inválido."),
  phone: z
    .string()
    .trim()
    .min(1, "Informe o telefone.")
    .max(30)
    .refine(
      (v) => v.replace(/\D/g, "").length >= 10,
      "Telefone incompleto — inclua o DDD.",
    ),
  isAdult: z.enum(["sim", "nao"], { error: "Diga se você tem 18 anos ou mais." }),
  goal: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v ? v : undefined)),
});
export type TrialClassInput = z.infer<typeof trialClassSchema>;
