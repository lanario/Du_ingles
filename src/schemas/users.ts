import { z } from "zod";
import { APP_ROLES } from "@/types/domain";
import { passwordRules } from "@/schemas/auth";

/**
 * O que o admin ainda edita num usuário existente. A criação não mora mais
 * aqui: toda conta nasce de um convite por WhatsApp preenchido pela própria
 * pessoa (ver `schemas/invites.ts`).
 */
export const updateUserSchema = z.object({
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
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const changeUserRoleSchema = z.object({
  role: z.enum(APP_ROLES as [string, ...string[]]),
});
export type ChangeUserRoleInput = z.infer<typeof changeUserRoleSchema>;

/**
 * Redefinição de senha feita pelo admin sobre a conta de outra pessoa.
 * Reaproveita `passwordRules` para que a senha provisória atenda à mesma
 * política do fluxo em que o próprio usuário escolhe a dele.
 */
export const adminSetPasswordSchema = z
  .object({
    password: passwordRules,
    confirmPassword: z.string().min(1, "Confirme a senha."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });
export type AdminSetPasswordInput = z.infer<typeof adminSetPasswordSchema>;
