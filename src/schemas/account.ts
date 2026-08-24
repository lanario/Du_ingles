import { z } from "zod";
import { passwordRules } from "@/schemas/auth";

/**
 * O que a pessoa edita na própria conta. Nome, telefone e nascimento — papel,
 * e-mail e organização continuam sendo assunto do admin (§3.1): mudar o
 * próprio papel seria escalada de privilégio, e trocar o e-mail exigiria o
 * fluxo de confirmação do Supabase Auth.
 */
export const updateMyProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Informe o nome completo.").max(160),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((v) => v || undefined),
  birthDate: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined),
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
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.password !== data.currentPassword, {
    message: "A nova senha precisa ser diferente da atual.",
    path: ["password"],
  });
export type ChangeMyPasswordInput = z.infer<typeof changeMyPasswordSchema>;
