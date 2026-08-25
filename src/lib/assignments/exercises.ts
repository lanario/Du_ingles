/**
 * O modelo de exercício digital de uma tarefa.
 *
 * Três pedaços moram em lugares diferentes do banco, e essa separação é
 * proposital (ver `0030_assignment_exercises.sql`):
 *
 *   enunciado  → `assignments.instructions.questions`  — o aluno lê
 *   gabarito   → `assignments.answer_key`              — o aluno NUNCA lê
 *   respostas  → `assignment_submissions.answers`      — o aluno escreve
 *
 * Tudo aqui é função pura sobre `Json`: o banco guarda jsonb sem contrato, e é
 * este módulo que transforma isso em algo tipado. Nada de `as Question[]` solto
 * pelo resto do código — se o jsonb estiver torto, o parse descarta a questão
 * inválida em vez de quebrar a página do aluno.
 */

import type { Json } from "@/types/database.types";

export const QUESTION_TYPES = [
  "multiple_choice",
  "true_false",
  "fill_blank",
  "short_text",
  "long_text",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

/** Tipos que o sistema consegue corrigir sozinho — o resto vai para o professor. */
const OBJECTIVE_TYPES = new Set<QuestionType>([
  "multiple_choice",
  "true_false",
  "fill_blank",
]);

export function isObjective(type: QuestionType): boolean {
  return OBJECTIVE_TYPES.has(type);
}

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  multiple_choice: "Múltipla escolha",
  true_false: "Verdadeiro ou falso",
  fill_blank: "Complete a lacuna",
  short_text: "Resposta curta",
  long_text: "Resposta dissertativa",
};

/** Marcador de lacuna que o professor escreve no enunciado de `fill_blank`. */
export const BLANK_TOKEN = "___";

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  /** Só em `multiple_choice`; 2 a 6 alternativas na ordem em que aparecem. */
  options?: string[];
  points: number;
}

/** Gabarito por questão. Ausente = questão dissertativa (não tem gabarito). */
export type AnswerKeyEntry =
  | { type: "multiple_choice"; correct: number }
  | { type: "true_false"; correct: boolean }
  | { type: "fill_blank"; accepted: string[] };

export type AnswerKey = Record<string, AnswerKeyEntry>;

/**
 * Resposta do aluno, sempre string — inclusive nas objetivas (índice da
 * alternativa como `"2"`, verdadeiro/falso como `"true"`/`"false"`). Um único
 * formato mantém o `<form>` do aluno trivial: tudo vira campo de FormData e
 * volta como texto, sem serialização especial por tipo.
 */
export type StudentAnswers = Record<string, string>;

// ---------------------------------------------------------------------------
// Leitura do jsonb
// ---------------------------------------------------------------------------

function asObject(value: Json | null): Record<string, Json> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, Json>;
}

/** `instructions` guarda `{ text }` desde a primeira versão das tarefas. */
export function readInstructionsText(instructions: Json | null): string | null {
  const obj = asObject(instructions);
  const text = obj?.text;
  return typeof text === "string" && text.length > 0 ? text : null;
}

export function readQuestions(instructions: Json | null): Question[] {
  const raw = asObject(instructions)?.questions;
  if (!Array.isArray(raw)) return [];

  const questions: Question[] = [];
  for (const item of raw) {
    const q = asObject(item);
    if (!q) continue;

    const { id, type, prompt } = q;
    if (typeof id !== "string" || !id) continue;
    if (typeof prompt !== "string" || !prompt.trim()) continue;
    if (typeof type !== "string") continue;
    if (!QUESTION_TYPES.includes(type as QuestionType)) continue;

    const questionType = type as QuestionType;
    const points = typeof q.points === "number" && q.points >= 0 ? q.points : 1;

    if (questionType === "multiple_choice") {
      const options = Array.isArray(q.options)
        ? q.options.filter((o): o is string => typeof o === "string" && o.trim().length > 0)
        : [];
      // Alternativa única não é escolha — a questão perdeu o sentido.
      if (options.length < 2) continue;
      questions.push({ id, type: questionType, prompt, options, points });
      continue;
    }

    questions.push({ id, type: questionType, prompt, points });
  }
  return questions;
}

export function readAnswerKey(answerKey: Json | null): AnswerKey {
  const obj = asObject(answerKey);
  if (!obj) return {};

  const key: AnswerKey = {};
  for (const [questionId, value] of Object.entries(obj)) {
    const entry = asObject(value);
    if (!entry) continue;

    if (entry.type === "multiple_choice" && typeof entry.correct === "number") {
      key[questionId] = { type: "multiple_choice", correct: entry.correct };
    } else if (entry.type === "true_false" && typeof entry.correct === "boolean") {
      key[questionId] = { type: "true_false", correct: entry.correct };
    } else if (entry.type === "fill_blank" && Array.isArray(entry.accepted)) {
      const accepted = entry.accepted.filter(
        (a): a is string => typeof a === "string" && a.trim().length > 0,
      );
      if (accepted.length > 0) key[questionId] = { type: "fill_blank", accepted };
    }
  }
  return key;
}

export function readAnswers(answers: Json | null): StudentAnswers {
  const obj = asObject(answers);
  if (!obj) return {};

  const parsed: StudentAnswers = {};
  for (const [questionId, value] of Object.entries(obj)) {
    if (typeof value === "string") parsed[questionId] = value;
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Correção automática
// ---------------------------------------------------------------------------

/**
 * Aluno de inglês digitando resposta curta erra acento, caixa e espaço o tempo
 * todo — e nada disso é o que a questão está avaliando. Normalizamos os dois
 * lados antes de comparar; a pontuação final da frase também sai, porque
 * "London." e "London" são a mesma resposta.
 */
function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.!?;,]+$/, "");
}

/** `null` = questão que o sistema não corrige (dissertativa ou sem gabarito). */
export type QuestionVerdict = boolean | null;

export interface AutoGradeResult {
  /** Acerto por questão, na chave do `question.id`. */
  verdicts: Record<string, QuestionVerdict>;
  /** Pontos obtidos nas questões corrigíveis. */
  score: number;
  /** Pontos possíveis nas questões corrigíveis (≠ nota máxima da tarefa). */
  max: number;
  /** Quantas questões ficaram para o professor corrigir na mão. */
  openCount: number;
}

export function autoGrade(
  questions: Question[],
  answerKey: AnswerKey,
  answers: StudentAnswers,
): AutoGradeResult {
  const verdicts: Record<string, QuestionVerdict> = {};
  let score = 0;
  let max = 0;
  let openCount = 0;

  for (const question of questions) {
    const key = answerKey[question.id];
    if (!isObjective(question.type) || !key) {
      verdicts[question.id] = null;
      openCount += 1;
      continue;
    }

    max += question.points;
    const answer = answers[question.id];
    if (answer === undefined || answer.trim() === "") {
      verdicts[question.id] = false;
      continue;
    }

    let correct = false;
    if (key.type === "multiple_choice") {
      correct = answer === String(key.correct);
    } else if (key.type === "true_false") {
      correct = answer === String(key.correct);
    } else {
      const given = normalizeText(answer);
      correct = key.accepted.some((accepted) => normalizeText(accepted) === given);
    }

    verdicts[question.id] = correct;
    if (correct) score += question.points;
  }

  return { verdicts, score, max, openCount };
}

/**
 * Converte a nota das objetivas para a escala da tarefa (`max_score`). Só faz
 * sentido quando não sobrou nada dissertativo — com questão aberta no meio, a
 * regra de três daria uma nota final que ignora metade da prova, então
 * devolvemos `null` e a nota fica com o professor.
 */
export function suggestedScore(
  auto: AutoGradeResult,
  maxScore: number | null,
): number | null {
  if (auto.openCount > 0 || auto.max === 0 || maxScore == null) return null;
  return Math.round((auto.score / auto.max) * maxScore * 10) / 10;
}

// ---------------------------------------------------------------------------
// Apresentação
// ---------------------------------------------------------------------------

/**
 * Versão em texto das respostas, gravada em `content`. As telas antigas (export
 * LGPD, relatórios, correção do professor de turma) leem `content` e continuam
 * funcionando sem saber que existem questões.
 */
export function answersToPlainText(
  questions: Question[],
  answers: StudentAnswers,
): string {
  return questions
    .map((question, index) => {
      const raw = answers[question.id] ?? "";
      let shown = raw;

      if (question.type === "multiple_choice") {
        const picked = Number(raw);
        shown = Number.isInteger(picked)
          ? (question.options?.[picked] ?? "(sem resposta)")
          : "(sem resposta)";
      } else if (question.type === "true_false") {
        shown = raw === "true" ? "Verdadeiro" : raw === "false" ? "Falso" : "(sem resposta)";
      } else if (!raw.trim()) {
        shown = "(sem resposta)";
      }

      return `${index + 1}. ${question.prompt}\nR: ${shown}`;
    })
    .join("\n\n");
}

/** Rótulo A, B, C… das alternativas. */
export function optionLabel(index: number): string {
  return String.fromCharCode(65 + index);
}
