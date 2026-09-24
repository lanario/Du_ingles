import http from "k6/http";
import { sleep } from "k6";
import { expectAuthedPage } from "../lib/checks.js";
import { firstIdFrom, thinkTime } from "../lib/util.js";

/**
 * Jornada do professor: painel → agenda → turmas (+ detalhe) → alunos →
 * planejador (+ detalhe de uma aula/tarefa real, se existir) → mensagens.
 * O planejador é o candidato mais provável a pesar (tela rica em imagem,
 * ver perf/04d16aa no histórico do repo), por isso entra com detalhe aberto.
 */
export function runTeacherJourney(baseUrl) {
  let res = http.get(`${baseUrl}/professor`, {
    tags: { page: "painel" },
    responseType: "none",
  });
  expectAuthedPage(res, "professor:painel");
  sleep(thinkTime());

  res = http.get(`${baseUrl}/professor/agenda`, {
    tags: { page: "agenda" },
    responseType: "none",
  });
  expectAuthedPage(res, "professor:agenda");
  sleep(thinkTime());

  res = http.get(`${baseUrl}/professor/turmas`, { tags: { page: "turmas" } });
  expectAuthedPage(res, "professor:turmas");
  const turmaId = firstIdFrom(res.body, "/professor/turmas/");
  sleep(thinkTime());

  if (turmaId) {
    res = http.get(`${baseUrl}/professor/turmas/${turmaId}`, {
      tags: { page: "turma-detalhe" },
      responseType: "none",
    });
    expectAuthedPage(res, "professor:turma-detalhe");
    sleep(thinkTime());
  }

  res = http.get(`${baseUrl}/professor/alunos`, {
    tags: { page: "alunos" },
    responseType: "none",
  });
  expectAuthedPage(res, "professor:alunos");
  sleep(thinkTime());

  res = http.get(`${baseUrl}/professor/planejador`, { tags: { page: "planejador" } });
  expectAuthedPage(res, "professor:planejador");
  const planId = firstIdFrom(res.body, "/professor/planejador/");
  sleep(thinkTime());

  if (planId) {
    res = http.get(`${baseUrl}/professor/planejador/${planId}`, {
      tags: { page: "planejador-detalhe" },
      responseType: "none",
    });
    expectAuthedPage(res, "professor:planejador-detalhe");
    sleep(thinkTime());
  }

  res = http.get(`${baseUrl}/professor/mensagens`, {
    tags: { page: "mensagens" },
    responseType: "none",
  });
  expectAuthedPage(res, "professor:mensagens");
  sleep(thinkTime());
}
