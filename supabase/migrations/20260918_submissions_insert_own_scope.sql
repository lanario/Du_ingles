-- ---------------------------------------------------------------------------
-- Entrega de tarefa só pra quem está matriculado na turma dela.
--
-- `submissions_insert_own` só conferia `student_id = auth.uid()` — sem checar
-- que a tarefa é de uma turma em que o aluno está matriculado, nem que é da
-- própria organização. `assignments_select_student` já faz as duas checagens
-- (`organization_id = auth_org() and enrolled_in_group(group_id)`); o insert
-- precisa da mesma régua, senão um aluno autenticado que descubra o id de uma
-- tarefa de outra turma (ou de outra organização) consegue plantar uma linha
-- de entrega nela via PostgREST direto, sem passar pela Server Action.
-- ---------------------------------------------------------------------------

drop policy if exists submissions_insert_own on public.assignment_submissions;

create policy submissions_insert_own
on public.assignment_submissions
for insert
to authenticated
with check (
  student_id = (select auth.uid())
  and organization_id = public.auth_org()
  and exists (
    select 1 from public.assignments a
    where a.id = assignment_submissions.assignment_id
      and public.enrolled_in_group(a.group_id)
  )
);
