import { browser } from "k6/browser";
import { check, sleep } from "k6";
import { BASE_URL } from "../lib/config.js";

/**
 * Testa o /login de verdade — não dá pra simular via k6/http puro: o form é
 * uma Server Action do Next.js (`action={formAction}` em
 * src/components/features/auth/login-form.tsx) cujo protocolo de wire
 * (header `Next-Action`, id da action) muda a cada build. Um browser real
 * (Chromium headless) preenche e envia o formulário como um usuário faria,
 * então continua funcionando não importa como o Next serializa a action por
 * baixo dos panos.
 *
 * Roda separado de main.js de propósito: login tem rate limit de 5
 * tentativas / 15 min por IP+e-mail (src/actions/auth/login.ts). Por isso
 * este script usa poucas VUs, poucas iterações (uma por conta da lista) e
 * uma pausa entre elas — o objetivo é confirmar que o login aguenta um
 * volume realista de gente entrando ao mesmo tempo no início da aula, não
 * martelar a mesma conta.
 *
 * Rode isolado:
 *   k6 run loadtest/scenarios/login-flow.js
 *
 * Pré-requisito: Chromium instalado e acessível ao k6 (ver README).
 */

const allUsers = JSON.parse(open("../data/test-users.json"));
const accounts = [
  ...(allUsers.students || []),
  ...(allUsers.teachers || []),
  ...(allUsers.admins || []),
].slice(0, Number(__ENV.LOGIN_FLOW_ACCOUNTS || 20));

if (accounts.length === 0) {
  throw new Error("data/test-users.json está vazio — nada para testar em login-flow.js.");
}

export const options = {
  scenarios: {
    login_flow: {
      executor: "shared-iterations",
      exec: "login",
      vus: Math.min(3, accounts.length),
      iterations: accounts.length,
      maxDuration: "20m",
      options: {
        browser: { type: "chromium" },
      },
    },
  },
  thresholds: {
    checks: ["rate>0.95"],
  },
};

export async function login() {
  const account = accounts[__ITER % accounts.length];
  const page = await browser.newPage();

  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });

    await page.locator('input[name="email"]').fill(account.email);
    await page.locator('input[name="password"]').fill(account.password);

    const navigation = page.waitForNavigation();
    await page.locator('button[type="submit"]').click();
    await navigation;

    check(page, {
      "login: saiu de /login (redirecionou pro painel)": (p) => !p.url().includes("/login"),
    });
  } finally {
    await page.close();
  }

  // Espaça as tentativas: mesmo com contas distintas, não há motivo pra
  // martelar o endpoint de auth mais rápido do que gente de verdade digitando.
  sleep(3 + Math.random() * 4);
}
