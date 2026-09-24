import {
  BASE_URL,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  MAX_VUS,
  RAMP_TIME,
  HOLD_TIME,
  RAMP_DOWN_TIME,
  PDF_RPS,
} from "./lib/config.js";
import { authenticate } from "./lib/auth.js";
import { pickAccount, seedSessionCookie } from "./lib/util.js";
import { runStudentJourney } from "./scenarios/student-journey.js";
import { runTeacherJourney } from "./scenarios/teacher-journey.js";
import { runAdminJourney } from "./scenarios/admin-journey.js";
import { runPdfAndReports } from "./scenarios/pdf-and-reports.js";

// Ver README para o formato — copie data/test-users.example.json e preencha
// com contas de teste reais antes de rodar. Fica fora do git de propósito.
const testUsers = JSON.parse(open(__ENV.TEST_USERS_FILE || "./data/test-users.json"));

// ~70% aluno, ~20% professor, ~10% admin — reflete que a maior parte do
// tráfego real é de alunos navegando; admin é o papel com menos gente mas
// telas mais pesadas (financeiro/relatórios), coberto à parte.
const TEACHER_VUS = Math.max(1, Math.round(MAX_VUS * 0.2));
const ADMIN_VUS = Math.max(1, Math.round(MAX_VUS * 0.1));
const STUDENT_VUS = MAX_VUS - TEACHER_VUS - ADMIN_VUS;

function stagesFor(target) {
  return [
    { duration: RAMP_TIME, target },
    { duration: HOLD_TIME, target },
    { duration: RAMP_DOWN_TIME, target: 0 },
  ];
}

export const options = {
  scenarios: {
    student_journey: {
      executor: "ramping-vus",
      exec: "studentScenario",
      startVUs: 0,
      stages: stagesFor(STUDENT_VUS),
      gracefulRampDown: "30s",
    },
    teacher_journey: {
      executor: "ramping-vus",
      exec: "teacherScenario",
      startVUs: 0,
      stages: stagesFor(TEACHER_VUS),
      gracefulRampDown: "30s",
    },
    admin_journey: {
      executor: "ramping-vus",
      exec: "adminScenario",
      startVUs: 0,
      stages: stagesFor(ADMIN_VUS),
      gracefulRampDown: "30s",
    },
    // Começa só quando as outras três já estão no platô (após RAMP_TIME), pra
    // medir o custo do PDF/relatório sob concorrência real, não sozinho.
    pdf_and_reports: {
      executor: "constant-arrival-rate",
      exec: "pdfScenario",
      rate: PDF_RPS,
      timeUnit: "1s",
      duration: HOLD_TIME,
      startTime: RAMP_TIME,
      preAllocatedVUs: 5,
      maxVUs: 20,
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<2500", "p(99)<5000"],
    http_req_failed: ["rate<0.02"],
    checks: ["rate>0.98"],
  },
};

/**
 * Roda uma vez, fora do relógio de nenhum VU: autentica cada conta de teste
 * direto na API do Supabase (ver lib/auth.js) e devolve o pool pronto pra
 * cada VU escolher uma conta e seguir sua jornada.
 */
export function setup() {
  const pool = { students: [], teachers: [], admins: [] };
  for (const role of Object.keys(pool)) {
    for (const cred of testUsers[role] || []) {
      pool[role].push(
        authenticate(SUPABASE_URL, SUPABASE_ANON_KEY, cred.email, cred.password),
      );
    }
  }
  if (
    pool.students.length === 0 ||
    pool.teachers.length === 0 ||
    pool.admins.length === 0
  ) {
    throw new Error(
      'data/test-users.json precisa de ao menos 1 conta em "students", "teachers" e "admins" (ver data/test-users.example.json).',
    );
  }
  console.log(
    `Pool de contas autenticado: ${pool.students.length} aluno(s), ` +
      `${pool.teachers.length} professor(es), ${pool.admins.length} admin(s).`,
  );
  return pool;
}

export function studentScenario(data) {
  seedSessionCookie(BASE_URL, pickAccount(data.students));
  runStudentJourney(BASE_URL);
}

export function teacherScenario(data) {
  seedSessionCookie(BASE_URL, pickAccount(data.teachers));
  runTeacherJourney(BASE_URL);
}

export function adminScenario(data) {
  seedSessionCookie(BASE_URL, pickAccount(data.admins));
  runAdminJourney(BASE_URL);
}

export function pdfScenario(data) {
  runPdfAndReports(BASE_URL, data);
}
