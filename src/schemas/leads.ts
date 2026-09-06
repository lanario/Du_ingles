import { z } from "zod";
import { emailField, nameField, phoneIssue } from "@/schemas/field-messages";

export const createLeadSchema = z.object({
  name: nameField({ requireSurname: false, max: 120 }),
  email: emailField,
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((v) => (v ? v : undefined)),
  message: z
    .string()
    .trim()
    .max(2000, "A mensagem passou de 2000 caracteres.")
    .optional(),
});
export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export const CREATE_LEAD_FIELDS = [
  ["name", "Nome"],
  ["email", "E-mail"],
  ["phone", "Telefone"],
  ["message", "Mensagem"],
] as const satisfies ReadonlyArray<readonly [string, string]>;

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
 *
 * As mensagens vêm de `field-messages.ts` e dizem o que está errado — este é o
 * ponto de conversão da landing, e "verifique os campos" num visitante que
 * ainda não é aluno custa o lead inteiro.
 */
export const trialClassSchema = z.object({
  name: nameField({ requireSurname: true, max: 120 }),
  email: emailField,
  phone: z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      const problem = phoneIssue(value);
      if (problem) ctx.addIssue({ code: "custom", message: problem });
    }),
  isAdult: z.enum(["sim", "nao"], {
    error:
      "Diga se você tem 18 anos ou mais — é o que define se falamos com um responsável.",
  }),
  goal: z
    .string()
    .trim()
    .max(2000, "O objetivo passou de 2000 caracteres. Resuma um pouco.")
    .optional()
    .transform((v) => (v ? v : undefined)),
});
export type TrialClassInput = z.infer<typeof trialClassSchema>;

/**
 * Rótulos na ordem da tela — é com eles que o resumo do erro nomeia os campos
 * recusados, usando exatamente o texto que está no formulário.
 */
export const TRIAL_CLASS_FIELDS = [
  ["name", "Nome completo"],
  ["email", "E-mail"],
  ["phone", "Telefone"],
  // Sem o "?" da pergunta que está na tela: o resumo é uma frase, e
  // "Corrija o campo Você tem 18 anos ou mais?." tropeça na pontuação.
  ["isAdult", "Maioridade (18 anos ou mais)"],
  ["goal", "Objetivo das aulas"],
] as const satisfies ReadonlyArray<readonly [string, string]>;
