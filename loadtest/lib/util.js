import http from "k6/http";

/**
 * Escolhe uma conta de teste pra esta VU, sempre a mesma ao longo da VU
 * (evita re-embaralhar sessão no meio de uma jornada). Várias VUs podem
 * cair na mesma conta — isso é esperado quando o pool de contas de teste é
 * menor que o número de VUs (ver README, seção "quantas contas eu preciso").
 */
export function pickAccount(accounts) {
  if (!accounts || accounts.length === 0) {
    throw new Error(
      "Nenhuma conta de teste disponível para este papel — confira loadtest/data/test-users.json.",
    );
  }
  const idx = (__VU - 1) % accounts.length;
  return accounts[idx];
}

/** Grava a sessão da conta escolhida no cookie jar padrão desta VU. */
export function seedSessionCookie(baseUrl, account) {
  const jar = http.cookieJar();
  jar.set(baseUrl, account.cookieName, account.cookieValue, { path: "/" });
}

/**
 * Extrai o primeiro UUID que aparece depois de um prefixo de rota no HTML
 * renderizado (ex.: prefix "/tarefas/" pega o primeiro link de detalhe de
 * tarefa da listagem). Usado pra navegar pra uma tela de detalhe sem
 * precisar cravar IDs fixos no script — o que existir nos dados da conta de
 * teste é o que vai ser visitado.
 */
export function firstIdFrom(html, prefix) {
  if (!html) return null;
  const escaped = prefix.replace(/[/]/g, "\\/");
  const re = new RegExp(escaped + "([0-9a-fA-F-]{36})");
  const match = String(html).match(re);
  return match ? match[1] : null;
}

/** Tempo de leitura entre uma tela e outra, pra não martelar sem pausa. */
export function thinkTime(minSeconds = 1, maxSeconds = 4) {
  return minSeconds + Math.random() * (maxSeconds - minSeconds);
}
