import test from "node:test";
import assert from "node:assert/strict";
import { parseQuestions } from "../src/lib/assignments/parse-questions";
import { questionsFieldSchema } from "../src/schemas/assignments";
import { BLANK_TOKEN } from "../src/lib/assignments/exercises";

test("parseQuestions: reconhece múltipla escolha com vários formatos de gabarito", () => {
  const text1 = `1. Which sentence is in the Present Perfect?
a) I went to London.
b) I have been to London.
c) I go to London.
Resposta: B`;

  const q1 = parseQuestions(text1);
  assert.equal(q1.length, 1);
  assert.equal(q1[0]!.type, "multiple_choice");
  assert.equal(q1[0]!.options.length, 3);
  assert.equal(q1[0]!.correctIndex, 1);

  const text2 = `1. Escolha a alternativa:
a) Opção A
b) Opção B
Gabarito: Letra A`;

  const q2 = parseQuestions(text2);
  assert.equal(q2.length, 1);
  assert.equal(q2[0]!.correctIndex, 0);

  const text3 = `1. Escolha a alternativa:
a) Opção A
b) Opção B
Resposta: Alternativa B (justificativa)`;

  const q3 = parseQuestions(text3);
  assert.equal(q3.length, 1);
  assert.equal(q3[0]!.correctIndex, 1);
});

test("parseQuestions: reconhece verdadeiro ou falso com parênteses e colchetes", () => {
  const text1 = `1. The sky is blue.
Resposta: (V)`;

  const q1 = parseQuestions(text1);
  assert.equal(q1.length, 1);
  assert.equal(q1[0]!.type, "true_false");
  assert.equal(q1[0]!.correctBool, true);

  const text2 = `1. London is in France.
Resposta: [F]`;

  const q2 = parseQuestions(text2);
  assert.equal(q2.length, 1);
  assert.equal(q2[0]!.type, "true_false");
  assert.equal(q2[0]!.correctBool, false);

  const text3 = `1. Water boils at 100 degrees.
Resposta: Verdadeiro`;

  const q3 = parseQuestions(text3);
  assert.equal(q3.length, 1);
  assert.equal(q3[0]!.type, "true_false");
  assert.equal(q3[0]!.correctBool, true);
});

test("parseQuestions: normaliza lacunas com [___] e reconhece respostas aceitas", () => {
  const text = `1. She [_____] (live) in Brazil since 2019. (2 pontos)
Resposta: has lived / 's lived`;

  const q = parseQuestions(text);
  assert.equal(q.length, 1);
  assert.equal(q[0]!.type, "fill_blank");
  assert.ok(q[0]!.prompt.includes(BLANK_TOKEN));
  assert.equal(q[0]!.points, 2);
  assert.deepEqual(q[0]!.accepted, ["has lived", "'s lived"]);
});

test("questionsFieldSchema: valida e retorna erros detalhados por questão", () => {
  // Questão com alternativas vazias
  const invalidPayload = JSON.stringify([
    {
      id: "q1",
      type: "multiple_choice",
      prompt: "Questão 1",
      points: 1,
      options: ["Opção 1", ""],
      correct: 0,
    },
    {
      id: "q2",
      type: "fill_blank",
      prompt: "Questão 2",
      points: 1,
      accepted: [""],
    },
  ]);

  const result = questionsFieldSchema.safeParse(invalidPayload);
  assert.equal(result.success, false);
  if (!result.success) {
    const messages = result.error.issues.map((i) => i.message);
    assert.ok(messages.some((m) => m.includes("Questão 1")));
    assert.ok(messages.some((m) => m.includes("Questão 2")));
  }
});

test("questionsFieldSchema: aceita questões válidas", () => {
  const validPayload = JSON.stringify([
    {
      id: "q1",
      type: "multiple_choice",
      prompt: "Qual é a capital da França?",
      points: 2,
      options: ["Londres", "Paris", "Roma"],
      correct: 1,
    },
    {
      id: "q2",
      type: "true_false",
      prompt: "A Terra é redonda.",
      points: 1,
      correct: true,
    },
    {
      id: "q3",
      type: "fill_blank",
      prompt: `Ela ${BLANK_TOKEN} professora.`,
      points: 1.5,
      accepted: ["é", "era"],
    },
    {
      id: "q4",
      type: "short_text",
      prompt: "Escreva uma palavra.",
      points: 1,
    },
  ]);

  const result = questionsFieldSchema.safeParse(validPayload);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.length, 4);
  }
});
