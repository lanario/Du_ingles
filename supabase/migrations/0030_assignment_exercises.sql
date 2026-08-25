-- Tarefas digitais: a tarefa deixa de ser só "título + instruções" e passa a
-- carregar uma lista de questões que o aluno responde dentro do app.
--
-- `assignments.instructions` já é jsonb e continua guardando `{ text }`; agora
-- também guarda `{ questions: [...] }` — o enunciado de cada questão, que o
-- aluno PRECISA ler. O gabarito vai em coluna separada (`answer_key`), nunca
-- misturado com o enunciado, pelo motivo explicado abaixo.

alter table public.assignments
  add column if not exists answer_key jsonb;

alter table public.assignment_submissions
  add column if not exists answers jsonb,
  add column if not exists auto_score numeric,
  add column if not exists auto_max numeric;

-- ---------------------------------------------------------------------------
-- Gabarito fora do alcance do aluno
-- ---------------------------------------------------------------------------
-- `assignments_select_student` dá ao aluno a linha inteira da tarefa da turma
-- dele — e é isso que queremos, ele precisa do enunciado. Só que o gabarito
-- mora na MESMA linha, então RLS (que filtra linhas) não separa os dois: a
-- barreira tem que ser de coluna. Mesmo padrão da 0022, que tirou UPDATE de
-- score/feedback de `authenticated` para o aluno não se auto-avaliar.
--
-- Efeito colateral a lembrar: coluna nova em `assignments` nasce invisível
-- para `authenticated` até ser adicionada ao grant abaixo.
revoke select on public.assignments from authenticated, anon;
grant select (
  id, organization_id, group_id, session_id, title, instructions,
  due_at, max_score, created_by, created_at
) on public.assignments to authenticated, anon;

-- Professor e admin leem o gabarito pelo client service-role, depois de
-- checar a posse da tarefa — ver `getAssignmentAnswerKey` no repositório.

-- ---------------------------------------------------------------------------
-- Prévia da correção automática fora do alcance do aluno
-- ---------------------------------------------------------------------------
-- auto_score/auto_max são sugestão de correção para o professor. O aluno só
-- enxerga nota quando o professor fecha a correção (status = 'graded' e a
-- coluna `score`), então essas duas ficam fora do SELECT de `authenticated`.
revoke select on public.assignment_submissions from authenticated, anon;
grant select (
  id, organization_id, assignment_id, student_id, content, answers,
  file_path, status, score, feedback, submitted_at, graded_at, graded_by
) on public.assignment_submissions to authenticated, anon;

-- INSERT era table-level, o que deixava o aluno criar a própria submissão já
-- com score/feedback/graded_by preenchidos — a 0022 fechou isso no UPDATE mas
-- não no INSERT. Fechando agora, e de quebra liberando `answers`.
revoke insert on public.assignment_submissions from authenticated, anon;
grant insert (
  organization_id, assignment_id, student_id, content, answers,
  file_path, status, submitted_at
) on public.assignment_submissions to authenticated;

-- O aluno reescreve as próprias respostas enquanto a entrega não foi corrigida
-- (`submissions_update_own_pending` decide QUAIS linhas; o grant, quais colunas).
grant update (answers) on public.assignment_submissions to authenticated;
