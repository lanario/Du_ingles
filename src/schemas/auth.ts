import { z } from "zod";
import { confirmPasswordMatches, emailField } from "@/schemas/field-messages";

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Informe a senha."),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const requestPasswordResetSchema = z.object({
  email: emailField,
});
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;

/**
 * Política de senha da plataforma. Em vez de encadear `.min`/`.regex` — que
 * numa senha vazia disparam todas as mensagens de uma vez —, o `superRefine`
 * sai na primeira falha quando o campo está em branco e, a partir daí, aponta
 * exatamente o que falta: o usuário lê "falta uma letra maiúscula", não
 * "senha inválida".
 *
 * O teto de 72 caracteres não é capricho: é o limite que o bcrypt do Supabase
 * aceita, e sem ele a recusa só apareceria no fim, como erro interno.
 */
export const passwordRules = z.string().superRefine((value, ctx) => {
  const add = (message: string) => ctx.addIssue({ code: "custom", message });

  if (value.length === 0) {
    add("Informe a senha.");
    return;
  }
  if (value.length < 8) {
    add(`A senha precisa de no mínimo 8 caracteres — faltam ${8 - value.length}.`);
  }
  if (value.length > 72) {
    add("A senha pode ter no máximo 72 caracteres.");
  }
  if (!/[a-z]/.test(value)) add("Falta uma letra minúscula na senha.");
  if (!/[A-Z]/.test(value)) add("Falta uma letra maiúscula na senha.");
  if (!/[0-9]/.test(value)) add("Falta um número na senha.");
});

export const setNewPasswordSchema = z
  .object({
    password: passwordRules,
    confirmPassword: z.string().min(1, "Confirme a senha."),
  })
  .superRefine(confirmPasswordMatches);
export type SetNewPasswordInput = z.infer<typeof setNewPasswordSchema>;
