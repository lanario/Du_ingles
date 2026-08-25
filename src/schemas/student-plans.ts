import { z } from "zod";
import { CEFR_LEVELS } from "@/types/domain";

export const PLAN_INTERVALS = ["month", "quarter", "semester", "year", "one_time"] as const;
export type PlanInterval = (typeof PLAN_INTERVALS)[number];

export const PLAN_ACCENTS = ["gold", "navy", "emerald", "violet"] as const;
export type PlanAccent = (typeof PLAN_ACCENTS)[number];

/** Nível comercial. `null`/ausente = plano avulso, fora da grade de níveis. */
export const PLAN_TIERS = ["standard", "premium", "elite"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const PLAN_WEEKLY_FREQUENCIES = [1, 2, 3] as const;
export type PlanWeeklyFrequency = (typeof PLAN_WEEKLY_FREQUENCIES)[number];

/**
 * O formulário envia preço como o admin digita: "249,90", "R$ 1.200",
 * "89.90". Normalizar aqui (e não no componente) mantém uma única definição
 * de "o que é um preço válido" — a Server Action é a fronteira de confiança,
 * e uma máscara no cliente é só conveniência.
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
    // pt-BR: o último separador é o decimal. "1.200,50" → 1200.50 e
    // "1,200.50" → 1200.50, sem precisar adivinhar a localidade do teclado.
    const lastComma = digits.lastIndexOf(",");
    const lastDot = digits.lastIndexOf(".");
    const decimalAt = Math.max(lastComma, lastDot);

    const normalized =
      decimalAt === -1
        ? digits.replace(/[.,]/g, "")
        : `${digits.slice(0, decimalAt).replace(/[.,]/g, "")}.${digits.slice(decimalAt + 1)}`;

    const value = Number(normalized);
    if (!Number.isFinite(value) || value < 0) {
      ctx.addIssue({ code: "custom", message: "Valor inválido." });
      return z.NEVER;
    }
    // Arredonda no centavo: "10.999" é erro de digitação, não meio centavo.
    return Math.round(value * 100);
  });

/**
 * Campo numérico opcional. Chega como string vazia quando o admin não
 * preencheu — e string vazia tem de virar "não informado", não zero: `null`
 * em `lessons_per_month` significa "ilimitado", `0` significaria "nenhuma
 * aula".
 */
function optionalInt(min: number, max: number, message: string) {
  return z
    .string()
    .trim()
    .optional()
    .transform((raw, ctx) => {
      if (!raw) return undefined;
      const value = Number(raw.replace(/[^\d-]/g, ""));
      if (!Number.isInteger(value) || value < min || value > max) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return value;
    });
}

/**
 * Benefícios do cartão. Chegam como uma linha por benefício num `<textarea>`:
 * é a forma mais rápida de o admin listar seis itens, e evita um editor de
 * lista com botão de "+" para cada linha.
 */
const featuresFromLines = z
  .string()
  .optional()
  .transform((raw) =>
    (raw ?? "")
      .split("\n")
      .map((line) => line.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 12),
  );

export const studentPlanSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do plano.").max(120),
  headline: z
    .string()
    .trim()
    .max(160, "Máximo de 160 caracteres.")
    .optional()
    .transform((v) => v || undefined),
  description: z
    .string()
    .trim()
    .max(2000, "Máximo de 2000 caracteres.")
    .optional()
    .transform((v) => v || undefined),
  features: featuresFromLines,

  priceCents: moneyToCents,
  billingInterval: z.enum(PLAN_INTERVALS),
  setupFeeCents: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || "0")
    .pipe(moneyToCents),
  trialDays: optionalInt(0, 365, "Entre 0 e 365 dias."),

  lessonsPerMonth: optionalInt(1, 400, "Informe um número válido."),
  minutesPerLesson: optionalInt(10, 480, "Entre 10 e 480 minutos."),
  tier: z
    .enum(PLAN_TIERS)
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
  weeklyFrequency: z
    .string()
    .trim()
    .optional()
    .transform((raw, ctx) => {
      if (!raw) return undefined;
      const value = Number(raw);
      if (!PLAN_WEEKLY_FREQUENCIES.includes(value as PlanWeeklyFrequency)) {
        ctx.addIssue({ code: "custom", message: "Escolha 1x, 2x ou 3x por semana." });
        return z.NEVER;
      }
      return value as PlanWeeklyFrequency;
    }),
  level: z
    .enum(CEFR_LEVELS as unknown as [string, ...string[]])
    .optional()
    .or(z.literal(""))
    .transform((v) => v || undefined),
  seatLimit: optionalInt(1, 10000, "Informe um número válido."),

  accent: z.enum(PLAN_ACCENTS).default("gold"),
  badge: z
    .string()
    .trim()
    .max(24, "Máximo de 24 caracteres.")
    .optional()
    .transform((v) => v || undefined),
  // Checkbox ausente no FormData significa desmarcado — daí o `=== "on"` em
  // vez de `z.coerce.boolean()`, que consideraria a string "false" como true.
  isFeatured: z.string().optional().transform((v) => v === "on"),
  isPublic: z.string().optional().transform((v) => v === "on"),
  sortOrder: z
    .string()
    .trim()
    .optional()
    .transform((raw) => {
      const value = Number((raw ?? "").replace(/\D/g, ""));
      return Number.isInteger(value) ? Math.min(value, 999) : 0;
    }),
});

export type StudentPlanInput = z.infer<typeof studentPlanSchema>;

/** Lê um plano direto do FormData da Server Action. */
export function planFieldsFromFormData(formData: FormData) {
  return {
    name: formData.get("name"),
    headline: formData.get("headline"),
    description: formData.get("description"),
    features: formData.get("features"),
    priceCents: formData.get("price"),
    billingInterval: formData.get("billingInterval"),
    setupFeeCents: formData.get("setupFee"),
    trialDays: formData.get("trialDays"),
    lessonsPerMonth: formData.get("lessonsPerMonth"),
    minutesPerLesson: formData.get("minutesPerLesson"),
    tier: formData.get("tier"),
    weeklyFrequency: formData.get("weeklyFrequency"),
    level: formData.get("level"),
    seatLimit: formData.get("seatLimit"),
    accent: formData.get("accent") || "gold",
    badge: formData.get("badge"),
    isFeatured: formData.get("isFeatured"),
    isPublic: formData.get("isPublic"),
    sortOrder: formData.get("sortOrder"),
  };
}

export const connectSettingsSchema = z.object({
  chargeModel: z.enum(["destination", "direct"]),
  applicationFeePercent: z
    .string()
    .trim()
    .optional()
    .transform((raw, ctx) => {
      const value = Number((raw || "0").replace(",", "."));
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        ctx.addIssue({ code: "custom", message: "Informe um percentual entre 0 e 100." });
        return z.NEVER;
      }
      // Duas casas: é a precisão que a Stripe aceita em `application_fee_percent`.
      return Math.round(value * 100) / 100;
    }),
});
