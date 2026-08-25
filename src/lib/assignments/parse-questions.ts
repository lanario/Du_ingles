/**
 * Leitura de questões coladas em texto.
 *
 * O professor já tem a prova pronta num Word, num PDF ou num e-mail. Digitar
 * tudo de novo campo a campo é o caminho mais lento para a mesma tarefa — então
 * aqui a gente aceita o texto como ele vem e tenta reconhecer enunciado,
 * alternativas e gabarito.
 *
 * Nada disso é adivinhação sagrada: o resultado cai no construtor como rascunho
 * editável, e o professor conserta o que o parser errou. Por isso a regra é
 * sempre preferir devolver uma questão aproveitável a descartar o bloco.
 */

import { BLANK_TOKEN, type QuestionType } from "./exercises";

/** Mesma forma do rascunho do construtor, sem o `id` (quem cola não escolhe id). */
export interface ParsedQuestion {
  type: QuestionType;
  prompt: string;
  points: number;
  options: string[];
  correctIndex: number;
  correctBool: boolean;
  accepted: string[];
}

/** Sem acento, sem caixa, sem pontuação de borda — para comparar gabarito com alternativa. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.;:!?)\]}"']+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Início de questão: "1.", "1)", "1 -", "Questão 2:", "Q3)". */
const QUESTION_START =
  /^\s*(?:(?:quest(?:ã|a)o|pergunta|exerc(?:í|i)cio|q)\s*)?(\d{1,3})\s*[.)\-–:]\s*/i;

/** Alternativa: "a)", "(A)", "b.", "*c)" — o asterisco marca a correta. */
const OPTION_START = /^\s*[*✔✓>»]?\s*(?:\(([a-hA-H])\)|([a-hA-H])\)|([a-hA-H])[.\-–])\s*/;

/** Alternativa por marcador, quando o texto não usa letras. */
const BULLET_START = /^\s*[*✔✓]?\s*[-–—•●○]\s+/;

/** Linha de gabarito solta: "Resposta: B", "Gabarito - verdadeiro", "Answer: has lived". */
const ANSWER_LINE =
  /^\s*(?:resposta\s*correta|resposta|gabarito|solu(?:ç|c)(?:ã|a)o|answer|key|resp|r)\s*[:\-–]\s*(.+)$/i;

/** Pontuação anotada no enunciado: "(2 pontos)", "[1,5 pt]", "- 3 pts". */
const POINTS_TAG = /[([\-–]\s*(\d+(?:[.,]\d+)?)\s*(?:pontos?|pts?|p)\s*[)\]]?\s*$/i;

/** Marca de alternativa correta grudada no fim: "(correta)", "(x)", "✔". */
const CORRECT_TAG = /\s*(?:[([]\s*(?:correta?|certa?|correct|x|✔|✓)\s*[)\]]|[✔✓])\s*$/i;

const TRUE_WORDS = new Set([
  "v",
  "verdadeiro",
  "verdadeira",
  "true",
  "t",
  "certo",
  "sim",
]);
const FALSE_WORDS = new Set(["f", "falso", "falsa", "false", "errado", "nao", "no"]);

function readBool(value: string): boolean | null {
  const word = normalize(value);
  if (TRUE_WORDS.has(word)) return true;
  if (FALSE_WORDS.has(word)) return false;
  return null;
}

/** Índice da letra: "a" → 0, "C)" → 2. Só letra sozinha conta como gabarito. */
function letterIndex(value: string): number | null {
  const match = /^\s*\(?([a-hA-H])\)?\s*[.)\-–]?\s*$/.exec(value);
  if (!match) return null;
  return match[1]!.toLowerCase().charCodeAt(0) - 97;
}

interface Block {
  promptLines: string[];
  options: { text: string; correct: boolean }[];
  answer: string | null;
}

/** Marca interna: linha que já sabemos ser alternativa (veio de split em linha única). */
const OPTION_MARK = "\u0000";

/** "a) um b) dois c) três" numa linha só — formato comum quando o texto vem de PDF. */
function splitInlineOptions(line: string): string[] | null {
  const marks = [...line.matchAll(/(?:^|\s)\(?([a-hA-H])\)\s*/g)];
  if (marks.length < 2) return null;
  // As letras precisam vir em sequência a partir de "a", senão é prosa com parênteses.
  const first = marks[0]![1]!.toLowerCase().charCodeAt(0);
  if (first !== 97) return null;
  for (let i = 0; i < marks.length; i += 1) {
    if (marks[i]![1]!.toLowerCase().charCodeAt(0) !== first + i) return null;
  }

  const pieces: string[] = [];
  for (let i = 0; i < marks.length; i += 1) {
    const start = marks[i]!.index! + marks[i]![0]!.length;
    const end = i + 1 < marks.length ? marks[i + 1]!.index! : line.length;
    pieces.push(OPTION_MARK + line.slice(start, end).trim());
  }
  const head = line.slice(0, marks[0]!.index!).trim();
  return head ? [head, ...pieces] : pieces;
}

/** Quebra o texto colado em blocos, um por questão. */
function toBlocks(raw: string): Block[] {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let current: Block | null = null;
  /** Sem numeração, uma linha em branco separa uma questão da próxima. */
  let numbered = false;
  let blankRun = 0;

  function open(): Block {
    const block: Block = { promptLines: [], options: [], answer: null };
    blocks.push(block);
    current = block;
    return block;
  }

  const expanded: string[] = [];
  for (const line of lines) {
    const inline = OPTION_START.test(line) ? null : splitInlineOptions(line);
    if (inline) expanded.push(...inline);
    else expanded.push(line);
  }

  for (const rawLine of expanded) {
    const forcedOption = rawLine.startsWith(OPTION_MARK);
    const line = (forcedOption ? rawLine.slice(1) : rawLine).trim();

    if (!line) {
      blankRun += 1;
      continue;
    }

    const startMatch = forcedOption ? null : QUESTION_START.exec(line);
    const isOption = forcedOption || OPTION_START.test(line);
    const isBullet = !forcedOption && BULLET_START.test(line);
    const answerMatch = forcedOption ? null : ANSWER_LINE.exec(line);

    // "a) alternativa" nunca abre questão: numeração só vale quando a linha não
    // é, ela mesma, uma alternativa da lista anterior.
    if (startMatch && !isOption) {
      numbered = true;
      const block = open();
      const rest = line.slice(startMatch[0]!.length).trim();
      if (rest) block.promptLines.push(rest);
      blankRun = 0;
      continue;
    }

    const block = current ?? open();

    if (answerMatch && block.promptLines.length > 0) {
      block.answer = answerMatch[1]!.trim();
      blankRun = 0;
      continue;
    }

    if ((isOption || isBullet) && block.promptLines.length > 0) {
      // O asterisco (ou o visto) na frente marca a alternativa correta — vale
      // tanto na lista em linhas quanto na que veio espremida numa linha só.
      let correct = /^\s*[*✔✓]/.test(line);
      let text = forcedOption
        ? line.replace(/^\s*[*✔✓]\s*/, "").trim()
        : line.replace(OPTION_START, "").replace(BULLET_START, "").trim();
      if (CORRECT_TAG.test(text)) {
        text = text.replace(CORRECT_TAG, "").trim();
        correct = true;
      }
      if (text) block.options.push({ text, correct });
      blankRun = 0;
      continue;
    }

    // Linha de texto comum. Sem numeração no documento, a linha em branco é o
    // único sinal de que uma questão acabou e outra começou; depois de já ter
    // alternativas, texto solto também só pode ser enunciado da próxima.
    if (
      block.options.length > 0 ||
      (!numbered && blankRun > 0 && block.promptLines.length > 0)
    ) {
      open().promptLines.push(line);
    } else {
      block.promptLines.push(line);
    }
    blankRun = 0;
  }

  return blocks;
}

function isTrueFalsePair(options: { text: string }[]): boolean {
  if (options.length !== 2) return false;
  const first = readBool(options[0]!.text);
  const second = readBool(options[1]!.text);
  return first !== null && second !== null && first !== second;
}

function buildQuestion(block: Block): ParsedQuestion | null {
  let prompt = block.promptLines.join(" ").replace(/\s+/g, " ").trim();
  if (!prompt) return null;

  let points = 1;
  const pointsMatch = POINTS_TAG.exec(prompt);
  if (pointsMatch) {
    const value = Number(pointsMatch[1]!.replace(",", "."));
    if (Number.isFinite(value) && value > 0 && value <= 100) {
      points = value;
      prompt = prompt.slice(0, pointsMatch.index).trim();
    }
  }

  // Lacunas chegam em tamanhos variados ("__", "_____", "......"); o app só
  // entende um marcador.
  prompt = prompt.replace(/_{2,}|\.{4,}/g, BLANK_TOKEN);

  const base: ParsedQuestion = {
    type: "short_text",
    prompt,
    points,
    options: ["", ""],
    correctIndex: 0,
    correctBool: true,
    accepted: [""],
  };

  const answer = block.answer;

  if (isTrueFalsePair(block.options)) {
    const marked = block.options.findIndex((o) => o.correct);
    const fromOption = marked >= 0 ? readBool(block.options[marked]!.text) : null;
    const fromAnswer = answer ? readBool(answer) : null;
    return { ...base, type: "true_false", correctBool: fromOption ?? fromAnswer ?? true };
  }

  if (block.options.length >= 2) {
    const options = block.options.slice(0, 6).map((o) => o.text);
    let correctIndex = block.options.slice(0, 6).findIndex((o) => o.correct);
    if (correctIndex < 0 && answer) {
      const byLetter = letterIndex(answer);
      if (byLetter !== null && byLetter < options.length) {
        correctIndex = byLetter;
      } else {
        const wanted = normalize(answer);
        correctIndex = options.findIndex((o) => normalize(o) === wanted);
      }
    }
    return {
      ...base,
      type: "multiple_choice",
      options,
      correctIndex: correctIndex >= 0 ? correctIndex : 0,
    };
  }

  if (answer) {
    const bool = readBool(answer);
    if (bool !== null) return { ...base, type: "true_false", correctBool: bool };
  }

  if (prompt.includes(BLANK_TOKEN)) {
    const accepted = answer
      ? answer
          .split(/\s*(?:\/|;|\||\bou\b|\bor\b)\s*/i)
          .map((a) => a.trim())
          .filter(Boolean)
          .slice(0, 8)
      : [];
    return {
      ...base,
      type: "fill_blank",
      accepted: accepted.length > 0 ? accepted : [""],
    };
  }

  // Sem alternativas e sem gabarito: pergunta aberta. Enunciado longo pede
  // resposta longa — o professor troca o tipo num clique se errarmos.
  return { ...base, type: prompt.length > 160 ? "long_text" : "short_text" };
}

/** Converte texto colado em rascunhos de questão. Texto irreconhecível → lista vazia. */
export function parseQuestions(raw: string): ParsedQuestion[] {
  if (!raw.trim()) return [];
  return toBlocks(raw)
    .map(buildQuestion)
    .filter((q): q is ParsedQuestion => q !== null);
}
