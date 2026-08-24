-- ---------------------------------------------------------------------------
-- Um aluno, uma turma
--
-- A aplicação sempre tratou a matrícula ativa como única (`listStudents()`
-- resolve `enrollment` como um único registro, a barra de turmas de
-- `/admin/alunos` filtra por `enrollment.groupId`), mas nada no banco impedia
-- duas linhas ativas para o mesmo aluno — e uma matrícula feita direto pela
-- tela da turma criava exatamente isso, com o aluno aparecendo em duas turmas
-- ao mesmo tempo.
--
-- O índice parcial abaixo fecha a porta: `status = 'active'` é único por
-- aluno. Matrículas encerradas (`cancelled`, `completed`, `paused`) ficam de
-- fora do índice, então o histórico continua inteiro e rematricular alguém na
-- mesma turma segue possível.
-- ---------------------------------------------------------------------------

-- Saneamento: onde já houver mais de uma ativa, a mais recente é a que vale.
with ranked as (
  select
    id,
    row_number() over (
      partition by student_id
      order by enrolled_at desc, id desc
    ) as rn
  from public.enrollments
  where status = 'active'
)
update public.enrollments as e
   set status = 'cancelled'
  from ranked as r
 where e.id = r.id
   and r.rn > 1;

create unique index if not exists enrollments_one_active_per_student
  on public.enrollments (student_id)
  where status = 'active';
