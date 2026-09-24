import http from "k6/http";
import { sleep } from "k6";
import { expectAuthedPage } from "../lib/checks.js";
import { firstIdFrom, thinkTime } from "../lib/util.js";

/**
 * Jornada do admin: painel → alunos → turmas (+ detalhe) → usuários (+
 * detalhe) → financeiro → relatórios → mensagens. É o papel com telas mais
 * agregadas (financeiro, relatórios cruzam várias tabelas), então tende a
 * pesar mais no banco por requisição, mesmo com poucos admins simultâneos.
 */
export function runAdminJourney(baseUrl) {
  let res = http.get(`${baseUrl}/admin`, {
    tags: { page: "painel" },
    responseType: "none",
  });
  expectAuthedPage(res, "admin:painel");
  sleep(thinkTime());

  res = http.get(`${baseUrl}/admin/alunos`, {
    tags: { page: "alunos" },
    responseType: "none",
  });
  expectAuthedPage(res, "admin:alunos");
  sleep(thinkTime());

  res = http.get(`${baseUrl}/admin/turmas`, { tags: { page: "turmas" } });
  expectAuthedPage(res, "admin:turmas");
  const turmaId = firstIdFrom(res.body, "/admin/turmas/");
  sleep(thinkTime());

  if (turmaId) {
    res = http.get(`${baseUrl}/admin/turmas/${turmaId}`, {
      tags: { page: "turma-detalhe" },
      responseType: "none",
    });
    expectAuthedPage(res, "admin:turma-detalhe");
    sleep(thinkTime());
  }

  res = http.get(`${baseUrl}/admin/usuarios`, { tags: { page: "usuarios" } });
  expectAuthedPage(res, "admin:usuarios");
  const userId = firstIdFrom(res.body, "/admin/usuarios/");
  sleep(thinkTime());

  if (userId) {
    res = http.get(`${baseUrl}/admin/usuarios/${userId}`, {
      tags: { page: "usuario-detalhe" },
      responseType: "none",
    });
    expectAuthedPage(res, "admin:usuario-detalhe");
    sleep(thinkTime());
  }

  res = http.get(`${baseUrl}/admin/financeiro`, {
    tags: { page: "financeiro" },
    responseType: "none",
  });
  expectAuthedPage(res, "admin:financeiro");
  sleep(thinkTime());

  res = http.get(`${baseUrl}/admin/relatorios`, {
    tags: { page: "relatorios" },
    responseType: "none",
  });
  expectAuthedPage(res, "admin:relatorios");
  sleep(thinkTime());

  res = http.get(`${baseUrl}/admin/mensagens`, {
    tags: { page: "mensagens" },
    responseType: "none",
  });
  expectAuthedPage(res, "admin:mensagens");
  sleep(thinkTime());
}
