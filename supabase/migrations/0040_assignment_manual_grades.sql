-- Nota por questão dissertativa: até aqui o professor só tinha um campo de
-- nota final por entrega — para questão aberta (short_text/long_text) não
-- havia como registrar o que foi corrigido em cada uma, só o feedback geral.
--
-- `manual_grades` guarda pontos por questão (`{questionId: pontos}`), no
-- mesmo espírito de `auto_score`/`auto_max` (0030): rascunho de correção que
-- só quem corrige enxerga, nunca o aluno. Como o grant de SELECT/UPDATE de
-- `authenticated` na 0030 é por coluna explícita, a coluna nova já nasce
-- fora do alcance dele — só o service-role (`repo.gradeSubmission`) grava.
alter table public.assignment_submissions
  add column if not exists manual_grades jsonb;
