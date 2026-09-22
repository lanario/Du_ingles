import { z } from "zod";
import {
  emailField,
  nameField,
  phoneIssue,
  confirmPasswordMatches,
} from "@/schemas/field-messages";
import { passwordRules } from "@/schemas/auth";

export const REGISTRATION_FOCUS_OPTIONS = [
  { value: "none", label: "Nenhuma preferência" },
  { value: "business", label: "Inglês para Negócios" },
  { value: "conversation", label: "Conversação em Inglês" },
  { value: "intensive", label: "Inglês Intensivo" },
  { value: "beginners", label: "Inglês para Iniciantes" },
  { value: "american", label: "Inglês Americano" },
] as const;

export const REGISTRATION_STYLE_OPTIONS = [
  { value: "flexible", label: "Flexível" },
  { value: "accessible", label: "Acessível" },
  { value: "motivating", label: "Motiva os alunos" },
  { value: "immersive", label: "Envolvente" },
  { value: "goal_focused", label: "Foco em metas" },
  { value: "patient", label: "Paciente" },
  { value: "organized", label: "Boa organização" },
  { value: "none", label: "Nenhuma preferência" },
] as const;

export const REGISTRATION_PROFESSION_OPTIONS = [
  { value: "administration", label: "Administração e gestão" },
  { value: "technology", label: "Tecnologia" },
  { value: "health", label: "Saúde" },
  { value: "education", label: "Educação" },
  { value: "sales", label: "Vendas e atendimento" },
  { value: "finance", label: "Finanças e contabilidade" },
  { value: "engineering", label: "Engenharia e indústria" },
  { value: "law", label: "Direito" },
  { value: "marketing", label: "Marketing e comunicação" },
  { value: "hospitality", label: "Turismo e hotelaria" },
  { value: "other", label: "Outro" },
] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || "");

export const studentRegistrationSchema = z
  .object({
    fullName: nameField({ requireSurname: true, max: 120 }),
    phone: z
      .string()
      .trim()
      .superRefine((value, ctx) => {
        const problem = phoneIssue(value);
        if (problem) ctx.addIssue({ code: "custom", message: problem });
      }),
    isAdult: z.enum(["yes", "no"], { error: "Informe se você tem 18 anos ou mais." }),
    guardianName: optionalText(120),
    guardianPhone: optionalText(30),
    guardianEmail: z
      .union([z.literal(""), emailField])
      .optional()
      .transform((value) => value || ""),
    goal: optionalText(2000),
    focusTopics: z
      .array(
        z.enum([
          "none",
          "business",
          "conversation",
          "intensive",
          "beginners",
          "american",
        ]),
      )
      .max(6),
    learningStyles: z
      .array(
        z.enum([
          "flexible",
          "accessible",
          "motivating",
          "immersive",
          "goal_focused",
          "patient",
          "organized",
          "none",
        ]),
      )
      .max(3),
    studySituation: z.enum(["work", "study", "both", "personal"]),
    profession: z.union([
      z.literal(""),
      z.enum([
        "administration",
        "technology",
        "health",
        "education",
        "sales",
        "finance",
        "engineering",
        "law",
        "marketing",
        "hospitality",
        "other",
      ]),
    ]),
    professionOther: optionalText(120),
    planId: z.string().uuid("Escolha um plano disponível."),
    email: emailField.transform((value) => value.toLowerCase()),
    password: passwordRules,
    confirmPassword: z.string().min(1, "Confirme a senha."),
    consent: z.literal("on", { error: "Aceite os termos e a política de privacidade." }),
    contactConsent: z.literal("on", {
      error: "Autorize o contato para podermos combinar sua aula experimental.",
    }),
  })
  .superRefine((data, ctx) => {
    confirmPasswordMatches(data, ctx);

    if (data.isAdult === "no") {
      if (!data.guardianName) {
        ctx.addIssue({
          code: "custom",
          path: ["guardianName"],
          message: "Informe o nome do responsável legal.",
        });
      }
      if (!data.guardianPhone) {
        ctx.addIssue({
          code: "custom",
          path: ["guardianPhone"],
          message: "Informe o telefone do responsável legal.",
        });
      } else {
        const guardianPhoneProblem = phoneIssue(data.guardianPhone);
        if (guardianPhoneProblem) {
          ctx.addIssue({
            code: "custom",
            path: ["guardianPhone"],
            message: guardianPhoneProblem,
          });
        }
      }
    }

    if (data.focusTopics.includes("none") && data.focusTopics.length > 1) {
      ctx.addIssue({
        code: "custom",
        path: ["focusTopics"],
        message: "Use “Nenhuma preferência” sozinha.",
      });
    }
    if (data.learningStyles.includes("none") && data.learningStyles.length > 1) {
      ctx.addIssue({
        code: "custom",
        path: ["learningStyles"],
        message: "Use “Nenhuma preferência” sozinha.",
      });
    }
    if (["work", "both"].includes(data.studySituation) && !data.profession) {
      ctx.addIssue({
        code: "custom",
        path: ["profession"],
        message: "Escolha sua área de trabalho.",
      });
    }
    if (data.profession === "other" && !data.professionOther) {
      ctx.addIssue({
        code: "custom",
        path: ["professionOther"],
        message: "Especifique sua profissão.",
      });
    }
  });

export type StudentRegistrationInput = z.infer<typeof studentRegistrationSchema>;
