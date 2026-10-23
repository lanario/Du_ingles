import { z } from "zod";
import { passwordRules } from "@/schemas/auth";
import { confirmPasswordMatches, optionalPhoneField } from "@/schemas/field-messages";

/**
 * O que a pessoa edita na própria conta. Nome, telefone e nascimento — papel,
 * e-mail e organização continuam sendo assunto do admin (§3.1): mudar o
 * próprio papel seria escalada de privilégio, e trocar o e-mail exigiria o
 * fluxo de confirmação do Supabase Auth.
 */
export const updateMyProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Informe o nome completo.").max(160),
  phone: optionalPhoneField,
  birthDate: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined)
    .refine(
      (v) => v === undefined || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))),
      "Informe uma data de nascimento válida.",
    ),
});
export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>;

/**
 * Troca de senha feita pelo próprio dono da conta. Pede a senha atual: sem
 * isso, uma sessão esquecida num computador emprestado viraria sequestro de
 * conta em dois cliques.
 */
export const changeMyPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual."),
    password: passwordRules,
    confirmPassword: z.string().min(1, "Confirme a nova senha."),
  })
  .superRefine(confirmPasswordMatches)
  .refine(
    (data) => data.password.length === 0 || data.password !== data.currentPassword,
    {
      message: "A nova senha precisa ser diferente da atual.",
      path: ["password"],
    },
  );
export type ChangeMyPasswordInput = z.infer<typeof changeMyPasswordSchema>;
