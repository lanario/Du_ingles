import { z } from "zod";
import { passwordRules } from "@/schemas/auth";
import {
  birthDateField,
  confirmPasswordMatches,
  cpfField,
  emailField,
  nameField,
  phoneIssue,
} from "@/schemas/field-messages";
import { normalizePhone } from "@/lib/phone";
import { APP_ROLES, type AppRole } from "@/types/domain";

/**
 * O que o admin preenche no painel de convite: papel, nome de referência e
 * o número que vai receber o link. Nada de e-mail ou senha aqui — quem
 * define isso é o convidado, no aceite.
 */
export const createInviteSchema = z.object({
  fullName: nameField({ requireSurname: false }),
  phone: z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      const problem = phoneIssue(value, { allowInternational: true });
      if (problem) {
        ctx.addIssue({ code: "custom", message: problem.replace("telefone", "WhatsApp") });
      }
    })
    .transform(normalizePhone),
  // `as` de tupla: `APP_ROLES` é um array só-leitura, e `z.enum` precisa da
  // forma tupla para inferir a união dos papéis em vez de `string` — sem isso
  // o campo validado sai daqui largo demais para quem consome o convite.
  role: z.enum(APP_ROLES as readonly [AppRole, ...AppRole[]], {
    message: "Escolha o papel de quem está sendo convidado.",
  }),
});
export type CreateInviteInput = z.infer<typeof createInviteSchema>;

export const CREATE_INVITE_FIELDS = [
  ["role", "Papel na plataforma"],
  ["fullName", "Nome completo"],
  ["phone", "WhatsApp"],
] as const satisfies ReadonlyArray<readonly [string, string]>;

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
    fullName: nameField({ requireSurname: true }),
    email: emailField,
    birthDate: birthDateField,
    cpf: cpfField,
    password: passwordRules,
    confirmPassword: z.string().min(1, "Confirme a senha."),
  })
  .superRefine(confirmPasswordMatches);
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

/**
 * Rótulo de cada campo, na ordem em que aparecem na tela. É o que permite ao
 * servidor responder "Corrija: E-mail e CPF" em vez de "dados inválidos", e ao
 * formulário listar os campos com erro no topo usando exatamente os mesmos
 * nomes que estão nos rótulos — dois textos diferentes para o mesmo campo
 * fariam a pessoa procurar um campo que não existe.
 */
export const ACCEPT_INVITE_FIELDS = [
  ["fullName", "Nome completo"],
  ["email", "E-mail"],
  ["birthDate", "Data de nascimento"],
  ["cpf", "CPF"],
  ["password", "Senha"],
  ["confirmPassword", "Confirmar senha"],
] as const satisfies ReadonlyArray<readonly [string, string]>;

export type AcceptInviteField = (typeof ACCEPT_INVITE_FIELDS)[number][0];
