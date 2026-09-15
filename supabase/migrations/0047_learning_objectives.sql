-- ---------------------------------------------------------------------------
-- Objetivos de aprendizado
--
-- O card "Meus objetivos" na tela de progresso do aluno sempre existiu, mas
-- não tinha dado nenhum atrás: `student_profiles.goals` era um texto livre
-- que nenhuma tela de professor ou coordenação jamais escrevia. Esta tabela é
-- o que faltava — o professor (ou a coordenação) registra uma meta para uma
-- turma inteira ou para um aluno específico, e o aluno acompanha o que já foi
-- concluído.
--
-- Sempre um alvo, nunca os dois: um objetivo de turma nasce sem `student_id`
-- e vale para todo mundo matriculado ali; um objetivo pessoal nasce sem
-- `group_id` e é só daquele aluno. O check abaixo impede a linha órfã (nenhum
-- alvo) e a ambígua (os dois ao mesmo tempo).
-- ---------------------------------------------------------------------------

create table if not exists public.learning_objectives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  group_id uuid references public.groups (id) on delete cascade,
  student_id uuid references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 200),
  description text check (char_length(description) <= 2000),
  is_completed boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references public.profiles (id),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_objectives_single_target check (
    (group_id is not null and student_id is null)
    or (group_id is null and student_id is not null)
  )
);

create index if not exists learning_objectives_group_idx
  on public.learning_objectives (group_id, is_completed)
  where group_id is not null;

create index if not exists learning_objectives_student_idx
  on public.learning_objectives (student_id, is_completed)
  where student_id is not null;

create or replace function public.learning_objectives_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists learning_objectives_set_updated_at on public.learning_objectives;
create trigger learning_objectives_set_updated_at
  before update on public.learning_objectives
  for each row
  execute function public.learning_objectives_touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
--
-- Escrita: o painel de admin/professor usa service-role (ver
-- `repositories/objectives.ts`) e a posse é checada na Server Action
-- (`canTouchGroup`/`canSeeStudent`, `lib/auth/staff.ts`) — a policy de
-- escrita abaixo é o reforço de banco para o mesmo desenho, não o único
-- portão. Leitura: o professor lê o que é seu pelo client comum, mesmo
-- molde de `assignments_select_teacher`; o aluno lê o que é dele — direto ou
-- da turma em que está matriculado agora (`enrolled_in_group`, já usada por
-- `assignments_select_student`).
-- ---------------------------------------------------------------------------
alter table public.learning_objectives enable row level security;

drop policy if exists learning_objectives_all_admin on public.learning_objectives;
create policy learning_objectives_all_admin
  on public.learning_objectives
  for all
  using (organization_id = public.auth_org() and public.is_admin())
  with check (organization_id = public.auth_org() and public.is_admin());

drop policy if exists learning_objectives_select_teacher on public.learning_objectives;
create policy learning_objectives_select_teacher
  on public.learning_objectives
  for select
  using (
    organization_id = public.auth_org()
    and (
      (group_id is not null and public.teaches_group(group_id))
      or (student_id is not null and public.teaches_student(student_id))
    )
  );

drop policy if exists learning_objectives_write_teacher on public.learning_objectives;
create policy learning_objectives_write_teacher
  on public.learning_objectives
  for all
  using (
    organization_id = public.auth_org()
    and (
      (group_id is not null and public.teaches_group(group_id))
      or (student_id is not null and public.teaches_student(student_id))
    )
  )
  with check (
    organization_id = public.auth_org()
    and created_by = (select auth.uid())
    and (
      (group_id is not null and public.teaches_group(group_id))
      or (student_id is not null and public.teaches_student(student_id))
    )
  );

drop policy if exists learning_objectives_select_student on public.learning_objectives;
create policy learning_objectives_select_student
  on public.learning_objectives
  for select
  using (
    organization_id = public.auth_org()
    and (
      (group_id is not null and public.enrolled_in_group(group_id))
      or student_id = (select auth.uid())
    )
  );
