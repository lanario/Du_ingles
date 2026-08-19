import { z } from "zod";

/**
 * Vocabulário e validação dos lançamentos financeiros.
 *
 * Duas decisões estruturam este arquivo:
 *
 * 1. **`kind` é derivado da categoria, não escolhido.** O banco separa
 *    receita, custo com professor e despesa operacional porque o DRE precisa
 *    dos três; o admin, porém, pensa em "mensalidade", "aluguel", "cachê" —
 *    não em classificação contábil. A tela pergunta a categoria e o mapa
 *    `CATEGORY_KIND` faz a tradução, o que mantém o DRE de
 *    `getFinanceOverview` correto sem cobrar isso de quem digita.
 *
 * 2. **Dinheiro entra como o admin digita.** "1.200,50", "R$ 89,90" e "89.90"
 *    são o mesmo valor; normalizar aqui — e não no componente — mantém uma
 *    única definição de valor válido na fronteira de confiança.
 */

export const FINANCE_KINDS = [
  "revenue",
  "professional_cost",
  "operating_expense",
] as const;
export type FinanceKind = (typeof FINANCE_KINDS)[number];

/** Como a tela agrupa: entra dinheiro ou sai dinheiro. */
export type FinanceDirection = "in" | "out";

export const FINANCE_STATUSES = ["pending", "paid"] as const;
export type FinanceStatus = (typeof FINANCE_STATUSES)[number];

export const PAYMENT_METHODS = [
  "pix",
  "boleto",
  "credit_card",
  "debit_card",
  "cash",
  "transfer",
  "other",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  pix: "PIX",
  boleto: "Boleto",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  cash: "Dinheiro",
  transfer: "Transferência",
  other: "Outro",
};

export interface FinanceCategory {
  id: string;
  label: string;
  /** Para onde o lançamento vai no DRE. */
  kind: FinanceKind;
  /** Explicação curta, mostrada no formulário. */
  hint: string;
}

/**
 * Linhas de negócio da escola. A ordem é a de frequência real de uso — a
 * mensalidade responde pela maior parte dos lançamentos de entrada, e o
 * professor pela maior parte dos de saída.
 */
export const REVENUE_CATEGORIES: FinanceCategory[] = [
  {
    id: "mensalidade",
    label: "Mensalidade",
    kind: "revenue",
    hint: "Plano recorrente do aluno",
  },
  {
    id: "matricula",
    label: "Matrícula",
    kind: "revenue",
    hint: "Taxa cobrada na entrada",
  },
  {
    id: "aula_avulsa",
    label: "Aula avulsa",
    kind: "revenue",
    hint: "Aula fora de plano",
  },
  {
    id: "material",
    label: "Material didático",
    kind: "revenue",
    hint: "Livro, apostila, licença",
  },
  {
    id: "exame",
    label: "Exame / certificação",
    kind: "revenue",
    hint: "Taxa de prova ou certificado",
  },
  {
    id: "outros",
    label: "Outras receitas",
    kind: "revenue",
    hint: "O que não se encaixa acima",
  },
];

export const EXPENSE_CATEGORIES: FinanceCategory[] = [
  {
    id: "professor",
    label: "Professores",
    kind: "professional_cost",
    hint: "Cachê, salário, hora-aula",
  },
  {
    id: "coordenacao",
    label: "Coordenação",
    kind: "professional_cost",
    hint: "Equipe pedagógica",
  },
  {
    id: "aluguel",
    label: "Aluguel e estrutura",
    kind: "operating_expense",
    hint: "Sala, condomínio, contas",
  },
  {
    id: "software",
    label: "Software",
    kind: "operating_expense",
    hint: "Plataformas e assinaturas",
  },
  {
    id: "marketing",
    label: "Marketing",
    kind: "operating_expense",
    hint: "Anúncios, mídia, material",
  },
  {
    id: "impostos",
    label: "Impostos e taxas",
    kind: "operating_expense",
    hint: "Tributos e tarifas bancárias",
  },
  {
    id: "contador",
    label: "Contabilidade",
    kind: "operating_expense",
    hint: "Honorários do contador",
  },
  {
    id: "outros_despesa",
    label: "Outras despesas",
    kind: "operating_expense",
    hint: "O que não se encaixa acima",
  },
];

export const ALL_CATEGORIES: FinanceCategory[] = [
  ...REVENUE_CATEGORIES,
  ...EXPENSE_CATEGORIES,
];

const CATEGORY_BY_ID = new Map(ALL_CATEGORIES.map((item) => [item.id, item]));

/** Categoria desconhecida (dado antigo, rótulo renomeado) não pode quebrar a tela. */
export function categoryOf(id: string, kind: FinanceKind): FinanceCategory {
  return (
    CATEGORY_BY_ID.get(id) ?? {
      id,
      label: kind === "revenue" ? "Outras receitas" : "Outras despesas",
      kind,
      hint: "",
    }
  );
}

export function directionOfKind(kind: FinanceKind): FinanceDirection {
  return kind === "revenue" ? "in" : "out";
}

export function categoriesFor(direction: FinanceDirection): FinanceCategory[] {
  return direction === "in" ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES;
}

/** `kind` que um lançamento recebe ao ser gravado, a partir da categoria. */
export function kindOfCategory(id: string, direction: FinanceDirection): FinanceKind {
  const category = CATEGORY_BY_ID.get(id);
  if (category) return category.kind;
  return direction === "in" ? "revenue" : "operating_expense";
}

/**
 * Valor em centavos a partir do que foi digitado. O último separador é o
 * decimal — assim "1.200,50" e "1,200.50" chegam ao mesmo número sem
 * adivinhar a localidade do teclado.
 */
const moneyToCents = z
  .string()
  .trim()
  .transform((raw, ctx) => {
    const digits = raw.replace(/[^\d,.-]/g, "");
    if (!digits) {
      ctx.addIssue({ code: "custom", message: "Informe o valor." });
      return z.NEVER;
    }

    const decimalAt = Math.max(digits.lastIndexOf(","), digits.lastIndexOf("."));
    const normalized =
      decimalAt === -1
        ? digits.replace(/[.,]/g, "")
        : `${digits.slice(0, decimalAt).replace(/[.,]/g, "")}.${digits.slice(decimalAt + 1)}`;

    const value = Number(normalized);
    if (!Number.isFinite(value) || value <= 0) {
      ctx.addIssue({ code: "custom", message: "O valor precisa ser maior que zero." });
      return z.NEVER;
    }
    // Arredonda no centavo: "10,999" é erro de digitação, não meio centavo.
    return Math.round(value * 100);
  });

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((value) => value || undefined);

/**
 * Um lançamento como o formulário o entrega.
 *
 * O `superRefine` garante o par status/paidOn que o check do banco também
 * exige — falhar aqui devolve mensagem no campo; falhar lá devolveria um erro
 * genérico de banco para quem só esqueceu de informar a data da baixa.
 */
export const financeEntrySchema = z
  .object({
    direction: z.enum(["in", "out"]),
    category: z.string().trim().min(1, "Escolha uma categoria."),
    description: z
      .string()
      .trim()
      .min(2, "Descreva o lançamento.")
      .max(160, "Máximo de 160 caracteres."),
    counterparty: optionalText(120, "Máximo de 120 caracteres."),
    amountCents: moneyToCents,
    /** Competência: o mês em que o lançamento pesa no resultado. */
    occurredOn: isoDate,
    dueOn: isoDate,
    status: z.enum(FINANCE_STATUSES),
    paidOn: z
      .string()
      .trim()
      .optional()
      .transform((value) => value || undefined),
    paymentMethod: z
      .string()
      .trim()
      .optional()
      .transform((value, ctx) => {
        if (!value) return undefined;
        if (!(PAYMENT_METHODS as readonly string[]).includes(value)) {
          ctx.addIssue({ code: "custom", message: "Forma de pagamento inválida." });
          return z.NEVER;
        }
        return value as PaymentMethod;
      }),
    notes: optionalText(600, "Máximo de 600 caracteres."),
  })
  .superRefine((value, ctx) => {
    const category = CATEGORY_BY_ID.get(value.category);
    if (!category || directionOfKind(category.kind) !== value.direction) {
      ctx.addIssue({
        code: "custom",
        path: ["category"],
        message: "A categoria não corresponde ao tipo de lançamento.",
      });
    }
    if (value.status === "paid") {
      if (!value.paidOn) {
        ctx.addIssue({
          code: "custom",
          path: ["paidOn"],
          message: "Informe a data em que o dinheiro entrou (ou saiu).",
        });
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(value.paidOn)) {
        ctx.addIssue({ code: "custom", path: ["paidOn"], message: "Data inválida." });
      }
    }
  });

export type FinanceEntryInput = z.infer<typeof financeEntrySchema>;

/** Lê o formulário e devolve o objeto bruto que o schema espera. */
export function financeFieldsFromFormData(formData: FormData) {
  const get = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };

  return {
    direction: get("direction"),
    category: get("category"),
    description: get("description"),
    counterparty: get("counterparty"),
    amountCents: get("amount"),
    occurredOn: get("occurredOn"),
    // Vencimento em branco cai na competência: quem lança uma despesa já paga
    // não deveria ter de repetir a mesma data em dois campos.
    dueOn: get("dueOn") || get("occurredOn"),
    status: get("status") || "pending",
    paidOn: get("paidOn"),
    paymentMethod: get("paymentMethod"),
    notes: get("notes"),
  };
}

/** `2026-08` — a competência exibida na tela, validada antes de virar query. */
export const monthKeySchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês inválido.");
