import { z } from "zod";
import { isValidCpf, onlyDigits } from "@/lib/cpf";

/**
 * Os campos de identificação do cadastro, com a mensagem que diz o que está
 * errado — não "dados inválidos".
 *
 * A regra aqui é sempre a mesma: checar do problema mais grosseiro para o mais
 * fino e parar no primeiro, para que a pessoa leia "falta o @" em vez de uma
 * lista de tudo que um e-mail deveria ter. Vivem num módulo só porque o mesmo
 * e-mail é validado no login, no convite e na conta — mensagens divergentes
 * entre telas fariam o mesmo erro parecer dois problemas diferentes.
 */

type Ctx = z.RefinementCtx;

function issue(ctx: Ctx, message: string): void {
  ctx.addIssue({ code: "custom", message });
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

export const emailField = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    if (value.length === 0) return issue(ctx, "Informe o e-mail.");
    if (/\s/.test(value)) return issue(ctx, "O e-mail não pode conter espaços.");

    const parts = value.split("@");
    if (parts.length === 1) {
      return issue(ctx, 'Falta o "@" no e-mail (ex.: nome@dominio.com).');
    }
    if (parts.length > 2) {
      return issue(ctx, 'O e-mail tem mais de um "@".');
    }

    const [local, domain] = parts as [string, string];
    if (local.length === 0) {
      return issue(ctx, 'Falta o nome antes do "@" (ex.: nome@dominio.com).');
    }
    if (domain.length === 0) {
      return issue(ctx, 'Falta o domínio depois do "@" (ex.: nome@gmail.com).');
    }
    if (!domain.includes(".")) {
      return issue(ctx, "O domínio do e-mail está incompleto (ex.: gmail.com).");
    }
    if (!EMAIL_SHAPE.test(value)) {
      return issue(ctx, "E-mail inválido. Confira o que foi digitado.");
    }
    if (value.length > 254) {
      return issue(ctx, "E-mail longo demais.");
    }
  });

/**
 * Confirmação de senha. Fica calada enquanto o campo está vazio: o "Confirme a
 * senha." do próprio campo já cobre esse caso, e as duas mensagens juntas
 * (vazio + "não coincidem") descrevem o mesmo erro duas vezes.
 */
export function confirmPasswordMatches(
  data: { password: string; confirmPassword: string },
  ctx: Ctx,
): void {
  if (data.confirmPassword.length === 0) return;
  if (data.password === data.confirmPassword) return;
  ctx.addIssue({
    code: "custom",
    path: ["confirmPassword"],
    message: "As senhas não coincidem. Repita exatamente a senha escolhida acima.",
  });
}

/** Letras, acentos e os sinais que aparecem em nome de gente ('  -  .). */
const NAME_SHAPE = /^[\p{L}\p{M}'.\-\s]+$/u;

/**
 * `requireSurname` separa os dois usos: no convite o admin digita um nome de
 * referência (pode ser só o primeiro), enquanto no cadastro o campo é o nome
 * civil de quem também informa CPF — ali cobrar o sobrenome é o certo.
 */
export function nameField({
  requireSurname,
  max = 160,
}: {
  requireSurname: boolean;
  max?: number;
}) {
  return z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      if (value.length === 0) return issue(ctx, "Informe o nome completo.");
      if (value.length < 2)
        return issue(ctx, "Nome curto demais — informe o nome completo.");
      if (value.length > max) {
        return issue(ctx, `O nome pode ter no máximo ${max} caracteres.`);
      }
      if (/\d/.test(value)) return issue(ctx, "O nome não pode conter números.");
      if (!NAME_SHAPE.test(value)) {
        return issue(ctx, "O nome tem caracteres que não são letras.");
      }
      if (requireSurname && !/\s/.test(value)) {
        return issue(ctx, "Informe também o sobrenome.");
      }
    })
    .transform((value) => value.replace(/\s+/g, " "));
}

/**
 * Telefone brasileiro digitado por gente: 10 números (fixo) ou 11 (celular),
 * sempre com DDD, com ou sem o +55 na frente.
 *
 * Cada recusa tem seu motivo — faltam dígitos, sobram dígitos, o DDD não
 * existe, o celular não começa com 9 — porque "telefone inválido" num campo
 * mascarado não diz o que consertar. `allowInternational` existe para o
 * convite, onde aluno morando fora é caso real; o formulário da aula
 * experimental é BR e não abre essa porta.
 */
export function phoneIssue(
  value: string,
  { allowInternational = false }: { allowInternational?: boolean } = {},
): string | null {
  if (value.trim().length === 0) return "Informe o telefone com DDD.";

  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return "Informe os números do telefone.";

  // +55 é o nosso DDI: tira para conferir DDD e número por baixo dele.
  const national =
    digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;

  if (allowInternational && !digits.startsWith("55") && digits.length >= 12) {
    return digits.length <= 15 ? null : "Número longo demais para um telefone.";
  }

  if (national.length < 10) {
    const missing = 10 - national.length;
    return `Telefone incompleto: ${national.length} de 10 números (falta${missing > 1 ? "m" : ""} ${missing}). Inclua o DDD.`;
  }
  if (national.length > 11) {
    return "Telefone com números demais: são 10 (fixo) ou 11 (celular), com o DDD.";
  }

  const ddd = Number(national.slice(0, 2));
  if (ddd < 11) {
    return "DDD inválido: os dois primeiros números são o DDD (ex.: 21, 11, 31).";
  }
  if (national.length === 11 && national[2] !== "9") {
    return "Celular inválido: depois do DDD, o número começa com 9.";
  }

  return null;
}

export const cpfField = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    if (value.length === 0) return issue(ctx, "Informe o CPF.");

    const digits = onlyDigits(value);
    if (digits.length === 0) return issue(ctx, "Informe os 11 números do CPF.");
    if (digits.length < 11) {
      const missing = 11 - digits.length;
      return issue(
        ctx,
        `CPF incompleto: ${digits.length} de 11 números (falta${missing > 1 ? "m" : ""} ${missing}).`,
      );
    }
    if (digits.length > 11) return issue(ctx, "CPF com números demais: são 11 no total.");
    if (/^(\d)\1{10}$/.test(digits)) {
      return issue(ctx, "CPF inválido: os 11 números não podem ser todos iguais.");
    }
    if (!isValidCpf(digits)) {
      return issue(ctx, "CPF inválido: confira os números digitados.");
    }
  })
  .transform(onlyDigits);

/**
 * Nascimento em ISO (`yyyy-mm-dd`) — é o que o `DateField` envia. Cada recusa
 * tem seu motivo: dia que não existe no calendário, data no futuro e ano
 * absurdo são erros diferentes e o texto diz qual deles é.
 */
export const birthDateField = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    if (value.length === 0) return issue(ctx, "Informe a data de nascimento.");

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      return issue(ctx, "Data de nascimento incompleta. Use o formato dd/mm/aaaa.");
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    const isRealDate =
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day;
    if (!isRealDate) {
      return issue(ctx, "Essa data não existe no calendário. Confira o dia e o mês.");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date > today) {
      return issue(ctx, "A data de nascimento não pode ser no futuro.");
    }
    if (year < 1900) {
      return issue(ctx, "Ano de nascimento anterior a 1900. Confira a data.");
    }
  });
