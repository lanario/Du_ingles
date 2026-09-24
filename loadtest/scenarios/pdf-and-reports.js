import http from "k6/http";
import { check, sleep } from "k6";
import { pickAccount, seedSessionCookie } from "../lib/util.js";
import { TEST_SESSION_ID_WITH_PDF } from "../lib/config.js";

/**
 * Isola os dois endpoints que fazem trabalho pesado no servidor a cada
 * request, em vez de servir HTML já pronto:
 *
 * - GET /api/sessions/[id]/pdf: lê um PDF já gerado do storage (não gera na
 *   hora — geração roda em background via `after()`), mas ainda assim passa
 *   por RLS + download do Storage. runtime="nodejs" porque @react-pdf/renderer
 *   usa APIs de Node — não roda no Edge.
 * - GET /api/relatorios/export: monta CSV a partir de queries agregadas
 *   (financeiro/pedagógico) a cada chamada, sem cache.
 *
 * Roda numa taxa fixa (constant-arrival-rate) em vez de escalar com o total
 * de VUs — queremos saber quantos desses req/s o servidor aguenta,
 * independente de quantos usuários estão só navegando em paralelo.
 */
export function runPdfAndReports(baseUrl, data) {
  if (TEST_SESSION_ID_WITH_PDF) {
    const account = data.teachers.length
      ? pickAccount(data.teachers)
      : pickAccount(data.admins);
    seedSessionCookie(baseUrl, account);
    const res = http.get(`${baseUrl}/api/sessions/${TEST_SESSION_ID_WITH_PDF}/pdf`, {
      tags: { page: "pdf-sessao" },
      responseType: "none",
    });
    check(res, {
      "pdf: HTTP 200": (r) => r.status === 200,
      "pdf: content-type correto": (r) =>
        (r.headers["Content-Type"] || "").includes("pdf"),
    });
  } else if (__ITER === 0 && __VU === 1) {
    console.warn(
      "TEST_SESSION_ID_WITH_PDF não definido — pulando o teste de /api/sessions/[id]/pdf. " +
        "Passe -e TEST_SESSION_ID_WITH_PDF=<uuid de uma aula com PDF gerado> para incluir.",
    );
  }

  if (data.admins.length) {
    const admin = pickAccount(data.admins);
    seedSessionCookie(baseUrl, admin);
    const rep = http.get(`${baseUrl}/api/relatorios/export?escopo=overview`, {
      tags: { page: "relatorio-csv" },
      responseType: "none",
    });
    check(rep, {
      "relatorio: HTTP 200": (r) => r.status === 200,
      "relatorio: é CSV": (r) => (r.headers["Content-Type"] || "").includes("csv"),
    });
  } else if (__ITER === 0 && __VU === 1) {
    console.warn(
      "Nenhuma conta admin em data/test-users.json — pulando /api/relatorios/export.",
    );
  }

  sleep(1);
}
