import { createReadStream } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import path from "node:path";

const [rawFile, summaryFile, reportFile] = process.argv.slice(2);
if (!rawFile || !summaryFile || !reportFile) {
  throw new Error(
    "Uso: node loadtest/analyze-results.mjs <raw.json> <summary.json> <report.md>",
  );
}

function bucket() {
  return { requests: 0, status: new Map(), durations: [], vus: 0, checksFailed: 0 };
}

const overall = bucket();
const byScenario = new Map();
const byPage = new Map();
const byMinute = new Map();
const failedChecks = new Map();
let firstAt = null;
let lastAt = null;
let droppedIterations = 0;
let failedHttp = 0;
let measuredHttp = 0;
let passedChecks = 0;
let measuredChecks = 0;

function get(map, key) {
  if (!map.has(key)) map.set(key, bucket());
  return map.get(key);
}

function record(target, metric, data) {
  if (metric === "http_reqs") {
    target.requests += data.value;
    const status = String(data.tags?.status ?? "0");
    target.status.set(status, (target.status.get(status) || 0) + data.value);
  } else if (metric === "http_req_duration") {
    target.durations.push(data.value);
  } else if (metric === "vus") {
    target.vus = Math.max(target.vus, data.value);
  }
}

const lines = createInterface({ input: createReadStream(rawFile, { encoding: "utf8" }) });
for await (const line of lines) {
  if (!line || line[0] !== "{") continue;
  const point = JSON.parse(line);
  if (point.type !== "Point" || !point.data) continue;
  const { metric, data } = point;
  if (metric === "dropped_iterations") droppedIterations += data.value;
  if (metric === "http_req_failed") {
    measuredHttp++;
    failedHttp += data.value;
  }
  if (metric === "checks") {
    measuredChecks++;
    passedChecks += data.value;
  }
  if (metric === "checks" && data.value === 0) {
    const label = data.tags?.check || "verificação desconhecida";
    failedChecks.set(label, (failedChecks.get(label) || 0) + 1);
  }
  if (!["http_reqs", "http_req_duration", "vus"].includes(metric)) continue;

  const timestamp = new Date(data.time).getTime();
  if (Number.isFinite(timestamp)) {
    firstAt = firstAt === null ? timestamp : Math.min(firstAt, timestamp);
    lastAt = lastAt === null ? timestamp : Math.max(lastAt, timestamp);
  }

  record(overall, metric, data);
  const minute = Number.isFinite(timestamp)
    ? new Date(timestamp).toISOString().slice(0, 16).replace("T", " ") + " UTC"
    : "sem horário";
  record(get(byMinute, minute), metric, data);

  if (metric === "vus") continue;
  const scenario = data.tags?.scenario || "setup";
  const page = data.tags?.page || "sem tag de página";
  record(get(byScenario, scenario), metric, data);
  record(get(byPage, `${scenario} / ${page}`), metric, data);
}

if (overall.requests === 0) {
  await writeFile(
    reportFile,
    [
      "# Diagnóstico de carga — Du Inglês",
      "",
      "Nenhuma requisição HTTP foi registrada. A execução terminou antes de gerar amostras analisáveis (por exemplo, durante o setup). Consulte a saída do k6 para identificar o erro original.",
      "",
    ].join("\n"),
    "utf8",
  );
  console.log(`Relatório salvo em ${path.resolve(reportFile)}`);
  process.exit(0);
}

for (const item of [
  overall,
  ...byScenario.values(),
  ...byPage.values(),
  ...byMinute.values(),
]) {
  item.durations.sort((a, b) => a - b);
}

function percentile(values, fraction) {
  if (values.length === 0) return null;
  return values[Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1)];
}

function countStatus(item, predicate) {
  let count = 0;
  for (const [status, total] of item.status)
    if (predicate(Number(status))) count += total;
  return count;
}

function formatMs(value) {
  return value === null ? "—" : `${value.toFixed(0)} ms`;
}

function row(label, item) {
  const errors = countStatus(item, (status) => status === 0 || status >= 400);
  const rate = item.requests > 0 ? ((errors / item.requests) * 100).toFixed(2) : "0.00";
  return `| ${label} | ${item.requests} | ${rate}% | ${formatMs(percentile(item.durations, 0.5))} | ${formatMs(percentile(item.durations, 0.95))} | ${formatMs(percentile(item.durations, 0.99))} | ${countStatus(item, (s) => s === 429)} | ${countStatus(item, (s) => s >= 500)} |`;
}

let summary = null;
try {
  summary = JSON.parse(await readFile(summaryFile, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const durationSeconds =
  firstAt !== null && lastAt !== null ? (lastAt - firstAt) / 1000 : 0;
const requestsPerSecond =
  summary?.metrics?.http_reqs?.rate ??
  (durationSeconds > 0 ? overall.requests / durationSeconds : null);
const httpFailureRate =
  summary?.metrics?.http_req_failed?.value ??
  (measuredHttp > 0 ? failedHttp / measuredHttp : null);
const checksRate =
  summary?.metrics?.checks?.value ??
  (measuredChecks > 0 ? passedChecks / measuredChecks : null);
const thresholdFailures = Object.entries(summary?.metrics || {}).flatMap(
  ([metric, value]) =>
    Object.entries(value.thresholds || {})
      .filter(([, failed]) => failed === true)
      .map(([threshold]) => `${metric}: ${threshold}`),
);

const statusList = [...overall.status.entries()]
  .sort((a, b) => Number(a[0]) - Number(b[0]))
  .map(([status, count]) => `${status}: ${count}`)
  .join(", ");

const report = [
  "# Diagnóstico de carga — Du Inglês",
  "",
  `**Período:** ${firstAt ? new Date(firstAt).toISOString() : "—"} a ${lastAt ? new Date(lastAt).toISOString() : "—"}`,
  `**Amostras HTTP:** ${overall.requests} requisições; ${overall.vus} VUs no maior ponto registrado.`,
  "",
  "## Resultado geral",
  "",
  `- Vazão média: ${typeof requestsPerSecond === "number" ? requestsPerSecond.toFixed(2) : "—"} req/s.`,
  `- Falha HTTP segundo k6: ${typeof httpFailureRate === "number" ? (httpFailureRate * 100).toFixed(2) + "%" : "—"}.`,
  `- Verificações aprovadas: ${typeof checksRate === "number" ? (checksRate * 100).toFixed(2) + "%" : "—"}.`,
  `- Iterações descartadas: ${droppedIterations}.`,
  `- Status: ${statusList}.`,
  `- Limites violados: ${summary ? (thresholdFailures.length ? thresholdFailures.join("; ") : "nenhum") : "não avaliáveis automaticamente após interrupção"}.`,
  `- Resumo do k6: ${summary ? "disponível" : "indisponível (execução interrompida; taxas calculadas a partir das amostras brutas)"}.`,
  "",
  "| Escopo | Requisições | Erros 4xx/5xx/rede | p50 | p95 | p99 | HTTP 429 | HTTP 5xx |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  row("Total", overall),
  "",
  "## Por fluxo",
  "",
  "| Fluxo | Requisições | Erros 4xx/5xx/rede | p50 | p95 | p99 | HTTP 429 | HTTP 5xx |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ...[...byScenario.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => row(key, value)),
  "",
  "## Páginas e endpoints por p95 (mais lentos primeiro)",
  "",
  "| Fluxo / página | Requisições | Erros 4xx/5xx/rede | p50 | p95 | p99 | HTTP 429 | HTTP 5xx |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ...[...byPage.entries()]
    .sort(
      ([, a], [, b]) =>
        (percentile(b.durations, 0.95) || 0) - (percentile(a.durations, 0.95) || 0),
    )
    .map(([key, value]) => row(key, value)),
  "",
  "## Evolução por minuto",
  "",
  "| Minuto | VUs máximas | Requisições | Erros 4xx/5xx/rede | p95 |",
  "| --- | ---: | ---: | ---: | ---: |",
  ...[...byMinute.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([minute, item]) => {
      const errors = countStatus(item, (status) => status === 0 || status >= 400);
      return `| ${minute} | ${item.vus} | ${item.requests} | ${errors} | ${formatMs(percentile(item.durations, 0.95))} |`;
    }),
  "",
  "## Verificações que falharam",
  "",
  ...(failedChecks.size
    ? [...failedChecks.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => `- ${name}: ${count}`)
    : ["Nenhuma verificação falhou."]),
  "",
  "## Como interpretar",
  "",
  "O p95 por página indica o primeiro caminho a investigar. Crescimento de p95 com VUs estáveis sugere saturação; HTTP 429/403 pode indicar proteção de borda ou rate limit; HTTP 5xx e iterações descartadas indicam falhas ou capacidade insuficiente. Confirme a causa com métricas da Vercel e do Supabase no mesmo intervalo. Os fluxos fazem apenas leituras HTTP e reutilizam as contas sintéticas configuradas.",
  "",
];

await writeFile(reportFile, report.join("\n"), "utf8");
console.log(`Relatório salvo em ${path.resolve(reportFile)}`);
