import http from "k6/http";
import { check } from "k6";
import { BASE_URL, MAX_VUS, PDF_RPS, TEST_SESSION_ID_WITH_PDF } from "./lib/config.js";
import { seedSessionCookie } from "./lib/util.js";
import {
  setup as authenticatePool,
  studentScenario as runStudent,
  teacherScenario as runTeacher,
  adminScenario as runAdmin,
  pdfScenario as runReports,
} from "./main.js";

if (!__ENV.MAX_VUS) {
  throw new Error("Defina MAX_VUS explicitamente; use 500 para o diagnóstico completo.");
}

const stepRampSeconds = Number(__ENV.STEP_RAMP_SECONDS || 60);
const stepHoldSeconds = Number(__ENV.STEP_HOLD_SECONDS || 60);
const peakHoldSeconds = Number(__ENV.PEAK_HOLD_SECONDS || 300);
const rampDownSeconds = Number(__ENV.RAMP_DOWN_SECONDS || 120);
const pdfWorkers = Number(__ENV.PDF_VUS || 20);

for (const [name, value] of Object.entries({
  STEP_RAMP_SECONDS: stepRampSeconds,
  STEP_HOLD_SECONDS: stepHoldSeconds,
  PEAK_HOLD_SECONDS: peakHoldSeconds,
  RAMP_DOWN_SECONDS: rampDownSeconds,
  PDF_VUS: pdfWorkers,
})) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} deve ser um inteiro positivo.`);
  }
}
// MAX_VUS representa clientes navegando; PDF/CSV é carga adicional, controlada.
const navigationVUs = MAX_VUS;
const teachers = Math.max(1, Math.round(navigationVUs * 0.2));
const admins = Math.max(1, Math.round(navigationVUs * 0.1));
const students = navigationVUs - teachers - admins;
const peakStartSeconds = 4 * stepRampSeconds + 3 * stepHoldSeconds;

function stages(target) {
  const result = [];
  for (const fraction of [0.1, 0.3, 0.6, 1]) {
    const level = Math.max(1, Math.round(target * fraction));
    result.push({ duration: `${stepRampSeconds}s`, target: level });
    if (fraction < 1) result.push({ duration: `${stepHoldSeconds}s`, target: level });
  }
  result.push({ duration: `${peakHoldSeconds}s`, target });
  result.push({ duration: `${rampDownSeconds}s`, target: 0 });
  return result;
}

export const options = {
  scenarios: {
    student_journey: {
      executor: "ramping-vus",
      exec: "studentScenario",
      startVUs: 0,
      stages: stages(students),
      gracefulRampDown: "30s",
    },
    teacher_journey: {
      executor: "ramping-vus",
      exec: "teacherScenario",
      startVUs: 0,
      stages: stages(teachers),
      gracefulRampDown: "30s",
    },
    admin_journey: {
      executor: "ramping-vus",
      exec: "adminScenario",
      startVUs: 0,
      stages: stages(admins),
      gracefulRampDown: "30s",
    },
    pdf_and_reports: {
      executor: "constant-arrival-rate",
      exec: "pdfScenario",
      rate: PDF_RPS,
      timeUnit: "1s",
      duration: `${peakHoldSeconds}s`,
      startTime: `${peakStartSeconds}s`,
      preAllocatedVUs: Math.min(5, pdfWorkers),
      maxVUs: pdfWorkers,
    },
  },
  thresholds: {
    http_req_failed: [
      "rate<0.02",
      { threshold: "rate<0.20", abortOnFail: true, delayAbortEval: "1m" },
    ],
    checks: [
      "rate>0.98",
      { threshold: "rate>0.70", abortOnFail: true, delayAbortEval: "1m" },
    ],
    "http_req_duration{scenario:student_journey}": [
      { threshold: "p(95)<3000", abortOnFail: true, delayAbortEval: "1m" },
    ],
    "http_req_duration{scenario:teacher_journey}": [
      { threshold: "p(95)<3000", abortOnFail: true, delayAbortEval: "1m" },
    ],
    "http_req_duration{scenario:admin_journey}": [
      { threshold: "p(95)<4000", abortOnFail: true, delayAbortEval: "1m" },
    ],
    "http_req_duration{scenario:pdf_and_reports}": [
      { threshold: "p(95)<5000", abortOnFail: true, delayAbortEval: "1m" },
    ],
    dropped_iterations: [
      { threshold: "count<1", abortOnFail: true, delayAbortEval: "1m" },
    ],
  },
};

export function setup() {
  const pool = authenticatePool();
  for (const [role, path] of [
    ["students", "/dashboard"],
    ["teachers", "/professor"],
    ["admins", "/admin"],
  ]) {
    seedSessionCookie(BASE_URL, pool[role][0]);
    const response = http.get(`${BASE_URL}${path}`, {
      tags: { page: `preflight-${role}` },
      responseType: "none",
    });
    const valid = check(response, {
      [`preflight ${role}: página autenticada`]: (r) =>
        r.status === 200 && !/\/(login|403)(?:[/?#]|$)/.test(r.url || ""),
    });
    if (!valid) {
      throw new Error(
        `Preflight de ${role} falhou: HTTP ${response.status} em ${response.url}`,
      );
    }
  }
  seedSessionCookie(BASE_URL, pool.admins[0]);
  const report = http.get(`${BASE_URL}/api/relatorios/export?escopo=overview`, {
    tags: { page: "preflight-relatorio-csv" },
    responseType: "none",
  });
  if (
    !check(report, {
      "preflight relatório: CSV autorizado": (r) =>
        r.status === 200 && (r.headers["Content-Type"] || "").includes("csv"),
    })
  ) {
    throw new Error(
      `Preflight do relatório falhou: HTTP ${report.status} em ${report.url}`,
    );
  }
  if (TEST_SESSION_ID_WITH_PDF) {
    seedSessionCookie(BASE_URL, pool.teachers[0]);
    const pdf = http.get(`${BASE_URL}/api/sessions/${TEST_SESSION_ID_WITH_PDF}/pdf`, {
      tags: { page: "preflight-pdf" },
      responseType: "none",
    });
    if (
      !check(pdf, {
        "preflight PDF: documento autorizado": (r) =>
          r.status === 200 && (r.headers["Content-Type"] || "").includes("pdf"),
      })
    ) {
      throw new Error(`Preflight do PDF falhou: HTTP ${pdf.status} em ${pdf.url}`);
    }
  }
  console.log(
    `${MAX_VUS} VUs de navegação (${students} alunos, ${teachers} professores, ` +
      `${admins} admins) + até ${pdfWorkers} VUs de PDF/CSV. Pico começa em ${peakStartSeconds}s.`,
  );
  return pool;
}

export function studentScenario(data) {
  runStudent(data);
}

export function teacherScenario(data) {
  runTeacher(data);
}

export function adminScenario(data) {
  runAdmin(data);
}

export function pdfScenario(data) {
  runReports(data);
}
