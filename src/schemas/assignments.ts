import { z } from "zod";

export const createAssignmentSchema = z.object({
  groupId: z.string().uuid("Selecione uma turma."),
  title: z.string().trim().min(2, "Informe o título.").max(200),
  dueAt: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  maxScore: z.coerce.number().min(0).max(1000).default(10),
});
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;

/**
 * Variante do admin no planejador: a mesma tarefa pode ir para várias turmas
 * de uma vez — vira uma linha em `assignments` por turma selecionada.
 */
export const createPlannerAssignmentSchema = z.object({
  groupIds: z
    .array(z.string().uuid())
    .min(1, "Selecione ao menos uma turma."),
  title: z.string().trim().min(2, "Informe o título.").max(200),
  instructions: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .transform((v) => v || undefined),
  dueAt: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  maxScore: z.coerce.number().min(0).max(1000).default(10),
});
export type CreatePlannerAssignmentInput = z.infer<typeof createPlannerAssignmentSchema>;

export const submitAssignmentSchema = z.object({
  content: z.string().trim().min(1, "Escreva sua resposta."),
});
export type SubmitAssignmentInput = z.infer<typeof submitAssignmentSchema>;

export const gradeSubmissionSchema = z.object({
  score: z.coerce.number().min(0).max(1000),
  feedback: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => v || undefined),
});
export type GradeSubmissionInput = z.infer<typeof gradeSubmissionSchema>;

// ---------------------------------------------------------------------------
// Exercícios digitais
// ---------------------------------------------------------------------------

/**
 * O construtor de questões é uma lista de tamanho variável — nada que caiba
 * bem em campos soltos de FormData. O painel serializa o rascunho inteiro num
 * único campo JSON e é ele que estes schemas validam.
 *
 * Note que o rascunho traz enunciado E gabarito juntos (é assim que o
 * professor pensa); quem separa os dois para gravar em colunas diferentes é
 * `splitQuestionDrafts`, no repositório de tarefas.
 */

const questionBaseShape = {
  id: z.string().trim().min(1).max(64),
  prompt: z.string().trim().min(1, "Escreva o enunciado.").max(1000),
  points: z.coerce.number().min(0).max(100).default(1),
};

export const questionDraftSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...questionBaseShape,
      type: z.literal("multiple_choice"),
      options: z
        .array(z.string().trim().min(1, "Alternativa vazia.").max(300))
        .min(2, "Dê ao menos duas alternativas.")
        .max(6),
      correct: z.coerce.number().int().min(0),
    })
    .refine((q) => q.correct < q.options.length, {
      message: "Marque qual alternativa é a correta.",
      path: ["correct"],
    }),
  z.object({
    ...questionBaseShape,
    type: z.literal("true_false"),
    correct: z.boolean(),
  }),
  z.object({
    ...questionBaseShape,
    type: z.literal("fill_blank"),
    accepted: z
      .array(z.string().trim().min(1, "Resposta vazia.").max(200))
      .min(1, "Informe ao menos uma resposta aceita.")
      .max(8),
  }),
  z.object({ ...questionBaseShape, type: z.literal("short_text") }),
  z.object({ ...questionBaseShape, type: z.literal("long_text") }),
]);

export type QuestionDraft = z.infer<typeof questionDraftSchema>;

/** Uma tarefa pode não ter questão nenhuma — aí ela é só instruções, como antes. */
export const questionDraftListSchema = z
  .array(questionDraftSchema)
  .max(50, "Máximo de 50 questões por tarefa.")
  .superRefine((questions, ctx) => {
    const seen = new Set<string>();
    for (const question of questions) {
      if (seen.has(question.id)) {
        ctx.addIssue({ code: "custom", message: "Questões duplicadas no formulário." });
        return;
      }
      seen.add(question.id);
    }
  });

/** O campo chega como string JSON; string vazia = tarefa sem questões. */
export const questionsFieldSchema = z
  .string()
  .optional()
  .transform((raw, ctx) => {
    if (!raw || raw.trim() === "") return [] as QuestionDraft[];
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      ctx.addIssue({ code: "custom", message: "Não foi possível ler as questões." });
      return z.NEVER;
    }
    const result = questionDraftListSchema.safeParse(parsed);
    if (!result.success) {
      const first = result.error.issues[0];
      ctx.addIssue({
        code: "custom",
        message: first?.message ?? "Revise as questões.",
      });
      return z.NEVER;
    }
    return result.data;
  });

export const createExerciseAssignmentSchema = createPlannerAssignmentSchema.extend({
  questions: questionsFieldSchema,
});
export type CreateExerciseAssignmentInput = z.infer<typeof createExerciseAssignmentSchema>;

/**
 * Respostas do aluno: um mapa `questionId -> texto`. Objetivas também viajam
 * como texto (índice da alternativa, `"true"`/`"false"`) — ver `StudentAnswers`
 * em `lib/assignments/exercises`.
 */
/**
 * A chave fica sem restrição de propósito: `z.record` reprova o objeto INTEIRO
 * quando uma única chave não casa, e chave estranha no payload não pode custar
 * ao aluno a tarefa toda. A filtragem pelos ids reais da tarefa acontece na
 * action, contra as questões lidas do banco.
 */
export const answersFieldSchema = z.record(z.string(), z.string().max(5000));

export const submitExerciseSchema = z
  .object({
    answers: answersFieldSchema,
    /** Rascunho salva sem cobrar resposta; envio definitivo, não. */
    draft: z.boolean().default(false),
  });
export type SubmitExerciseInput = z.infer<typeof submitExerciseSchema>;
