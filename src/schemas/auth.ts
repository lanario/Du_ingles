import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Informe o e-mail.").email("E-mail inválido."),
  password: z.string().min(1, "Informe a senha."),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const requestPasswordResetSchema = z.object({
  email: z.string().trim().min(1, "Informe o e-mail.").email("E-mail inválido."),
});
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;

export const passwordRules = z
  .string()
  .min(8, "A senha precisa ter no mínimo 8 caracteres.")
  .regex(/[a-z]/, "A senha precisa de ao menos uma letra minúscula.")
  .regex(/[A-Z]/, "A senha precisa de ao menos uma letra maiúscula.")
  .regex(/[0-9]/, "A senha precisa de ao menos um número.");

export const setNewPasswordSchema = z
  .object({
    password: passwordRules,
    confirmPassword: z.string().min(1, "Confirme a senha."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });
export type SetNewPasswordInput = z.infer<typeof setNewPasswordSchema>;
