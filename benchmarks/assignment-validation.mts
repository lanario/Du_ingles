import { performance } from "node:perf_hooks";
import { questionDraftListSchema } from "../src/schemas/assignments";

const iterations = Number(process.env.BENCH_ITERATIONS ?? 5_000);
if (!Number.isInteger(iterations) || iterations < 1) {
  throw new Error("BENCH_ITERATIONS deve ser um inteiro positivo.");
}

const questions = Array.from({ length: 50 }, (_, index) => {
  const base = { id: `q-${index}`, prompt: `Questão ${index + 1}`, points: 2 };
  switch (index % 4) {
    case 0:
      return { ...base, type: "multiple_choice", options: ["A", "B", "C"], correct: 1 };
    case 1:
      return { ...base, type: "true_false", correct: true };
    case 2:
      return { ...base, type: "fill_blank", accepted: ["answer"] };
    default:
      return { ...base, type: "short_text" };
  }
});

function validate() {
  const result = questionDraftListSchema.safeParse(questions);
  if (!result.success || result.data.length !== 50) {
    throw new Error("A validação de referência falhou; benchmark inválido.");
  }
}

for (let i = 0; i < 500; i++) validate();

const durations = new Float64Array(iterations);
const started = performance.now();
for (let i = 0; i < iterations; i++) {
  const before = performance.now();
  validate();
  durations[i] = performance.now() - before;
}
const elapsedMs = performance.now() - started;
durations.sort();

const result = {
  benchmark: "questionDraftListSchema.safeParse (50 questões)",
  iterations,
  elapsedMs: Number(elapsedMs.toFixed(2)),
  operationsPerSecond: Number(((iterations * 1000) / elapsedMs).toFixed(1)),
  p50Ms: Number(durations[Math.floor(iterations * 0.5)]!.toFixed(4)),
  p95Ms: Number(durations[Math.floor(iterations * 0.95)]!.toFixed(4)),
  node: process.version,
};
console.log(JSON.stringify(result, null, 2));

const minimum = Number(process.env.BENCH_MIN_OPS ?? 0);
if (minimum > 0 && result.operationsPerSecond < minimum) {
  process.exitCode = 1;
}
