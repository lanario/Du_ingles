-- Comentário do professor por questão dissertativa: até aqui, quem corrige
-- uma questão "corrija você" só registrava pontos (`manual_grades`, 0040) —
-- não havia onde escrever a resposta certa nem uma explicação para o aluno.
--
-- `manual_notes` guarda texto por questão (`{questionId: texto}`). Ao
-- contrário de `manual_grades`, que é rascunho de correção que só quem
-- corrige enxerga, esta coluna É concedida a `authenticated`: o aluno precisa
-- ler o comentário quando a entrega é corrigida. A escrita continua só pelo
-- service-role (`repo.gradeSubmission`), então o grant abaixo é só de SELECT.
alter table public.assignment_submissions
  add column if not exists manual_notes jsonb;

grant select (manual_notes) on public.assignment_submissions to authenticated, anon;
