-- ---------------------------------------------------------------------------
-- Aluno lê o perfil de quem divide turma com ele.
--
-- O chat de turma (group_chats) já monta participantes e mensagens a partir
-- de sender_id/profile_id, mas o join com `profiles` sempre voltava nulo
-- pro aluno: a única policy de SELECT que o alcançava era `profiles_select_self`.
-- Resultado: toda mensagem de colega ou do professor aparecia com remetente
-- "—", e o painel de membros saía praticamente vazio.
--
-- A regra: o aluno lê a ficha de quem divide (ou dividiu) turma com ele —
-- colega de classe ou professor responsável — e de mais ninguém da escola.
-- "Dividiu" e não só "divide": mensagem antiga de quem já saiu da turma
-- continua precisando de um nome, não de um "—" (mesmo raciocínio de
-- `teaches_student`, que também não filtra por status de matrícula).
-- ---------------------------------------------------------------------------

create or replace function public.studies_with(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.enrollments e1
    join public.enrollments e2 on e2.group_id = e1.group_id
    where e1.student_id = auth.uid()
      and e2.student_id = p_profile
  )
  or exists (
    select 1
    from public.enrollments e
    join public.groups g on g.id = e.group_id
    where e.student_id = auth.uid()
      and g.teacher_id = p_profile
  );
$$;

revoke execute on function public.studies_with(uuid) from public;
revoke execute on function public.studies_with(uuid) from anon;
grant execute on function public.studies_with(uuid) to authenticated;

drop policy if exists profiles_select_student_classmates on public.profiles;

create policy profiles_select_student_classmates
on public.profiles
for select
to authenticated
using (
  organization_id = public.auth_org()
  and public.auth_role() = 'student'::public.app_role
  and role in ('student'::public.app_role, 'teacher'::public.app_role)
  and public.studies_with(id)
);
