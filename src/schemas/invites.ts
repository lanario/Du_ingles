import { z } from "zod";
import { passwordRules } from "@/schemas/auth";
import { isValidCpf, onlyDigits } from "@/lib/cpf";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { APP_ROLES } from "@/types/domain";

/**
 * O que o admin preenche no painel de convite: papel, nome de referência e
 * o número que vai receber o link. Nada de e-mail ou senha aqui — quem
 * define isso é o convidado, no aceite.
 */
export const createInviteSchema = z.object({
  fullName: z.string().trim().min(2, "Informe o nome completo.").max(160),
  phone: z
    .string()
    .trim()
    .min(1, "Informe o número do WhatsApp.")
    .refine(isValidPhone, "Número de WhatsApp inválido.")
    .transform(normalizePhone),
  role: z.enum(APP_ROLES as [string, ...string[]]),
});
export type CreateInviteInput = z.infer<typeof createInviteSchema>;

function isRealBirthDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date <= today && date.getFullYear() >= 1900;
}

/**
 * O cadastro do convidado. Tudo obrigatório: o convite só vira conta com o
 * perfil completo — é essa a regra que o fluxo por WhatsApp pede, já que
 * ninguém revisa esses dados depois do primeiro login.
 *
 * O telefone não entra: vem do convite e não é editável (foi para ele que
 * o link foi enviado). Aceitar um telefone do formulário abriria a porta
 * para o convidado se cadastrar com outro número.
 */
export const acceptInviteSchema = z
  .object({
    fullName: z.string().trim().min(2, "Informe o nome completo.").max(160),
    email: z.string().trim().min(1, "Informe o e-mail.").email("E-mail inválido."),
    birthDate: z
      .string()
      .trim()
      .min(1, "Informe a data de nascimento.")
      .refine(isRealBirthDate, "Data de nascimento inválida."),
    cpf: z
      .string()
      .trim()
      .min(1, "Informe o CPF.")
      .refine(isValidCpf, "CPF inválido.")
      .transform(onlyDigits),
    password: passwordRules,
    confirmPassword: z.string().min(1, "Confirme a senha."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
