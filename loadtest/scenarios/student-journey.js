import http from "k6/http";
import { sleep } from "k6";
import { expectAuthedPage } from "../lib/checks.js";
import { firstIdFrom, thinkTime } from "../lib/util.js";

/**
 * Jornada do aluno: painel → agenda → tarefas (+ detalhe de uma tarefa real,
 * se existir) → biblioteca → turmas → progresso → mensagens. Mistura leitura
 * de páginas simples com telas que agregam mais dado (progresso, turmas).
 */
export function runStudentJourney(baseUrl) {
  let res = http.get(`${baseUrl}/dashboard`, {
    tags: { page: "dashboard" },
    responseType: "none",
  });
  expectAuthedPage(res, "aluno:dashboard");
  sleep(thinkTime());

  res = http.get(`${baseUrl}/agenda`, { tags: { page: "agenda" }, responseType: "none" });
  expectAuthedPage(res, "aluno:agenda");
  sleep(thinkTime());

  res = http.get(`${baseUrl}/tarefas`, { tags: { page: "tarefas" } });
  expectAuthedPage(res, "aluno:tarefas");
  const taskId = firstIdFrom(res.body, "/tarefas/");
  sleep(thinkTime());

  if (taskId) {
    res = http.get(`${baseUrl}/tarefas/${taskId}`, { tags: { page: "tarefa-detalhe" } });
    expectAuthedPage(res, "aluno:tarefa-detalhe");
    sleep(thinkTime());
  }

  res = http.get(`${baseUrl}/biblioteca`, {
    tags: { page: "biblioteca" },
    responseType: "none",
  });
  expectAuthedPage(res, "aluno:biblioteca");
  sleep(thinkTime());

  res = http.get(`${baseUrl}/turmas`, { tags: { page: "turmas" }, responseType: "none" });
  expectAuthedPage(res, "aluno:turmas");
  sleep(thinkTime());

  res = http.get(`${baseUrl}/progresso`, {
    tags: { page: "progresso" },
    responseType: "none",
  });
  expectAuthedPage(res, "aluno:progresso");
  sleep(thinkTime());

  res = http.get(`${baseUrl}/mensagens`, {
    tags: { page: "mensagens" },
    responseType: "none",
  });
  expectAuthedPage(res, "aluno:mensagens");
  sleep(thinkTime());
}
