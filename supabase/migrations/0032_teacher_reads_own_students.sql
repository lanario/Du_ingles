-- ---------------------------------------------------------------------------
-- O professor lê o perfil dos próprios alunos.
--
-- Até aqui, a única policy de SELECT em `profiles` que alcançava um professor
-- era `profiles_select_self`. Todo join que passa por `profiles` voltava nulo
-- para ele: a lista de matrículas da turma, os participantes do chat e o
-- autor de cada mensagem apareciam como "—". A área do professor
-- (`/professor`) vive dessas três telas, então o recorte precisava existir no
-- banco, não só na aplicação.
--
-- A regra é a mesma que as Server Actions já aplicam (`canSeeStudent`, em
-- `lib/auth/staff.ts`): ele lê a ficha de quem estuda — ou estudou — numa
-- turma dele, e de mais ninguém da escola. Qualquer status de matrícula
-- conta, porque a lista da turma também mostra quem saiu.
--
-- A policy é permissiva: soma acesso ao professor, não tira de ninguém. Admin
-- e aluno seguem exatamente como estavam.
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER pelo mesmo motivo de `teaches_group`: a checagem precisa
-- enxergar `enrollments`/`groups` inteiros, não o recorte de RLS de quem
-- pergunta. Não consulta `profiles`, então não há recursão de policy.
create or replace function public.teaches_student(p_student uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.enrollments e
    join public.groups g on g.id = e.group_id
    where e.student_id = p_student
      and g.teacher_id = auth.uid()
  );
$$;

-- Só quem está logado: a função usa `auth.uid()`, então para `anon` ela
-- responderia sempre falso — mas ficaria exposta em /rest/v1/rpc à toa.
revoke execute on function public.teaches_student(uuid) from public;
revoke execute on function public.teaches_student(uuid) from anon;
grant execute on function public.teaches_student(uuid) to authenticated;

drop policy if exists profiles_select_teacher_students on public.profiles;

create policy profiles_select_teacher_students
on public.profiles
for select
to authenticated
using (
  organization_id = public.auth_org()
  and public.auth_role() = 'teacher'::public.app_role
  and role = 'student'::public.app_role
  and public.teaches_student(id)
);
