-- ---------------------------------------------------------------------------
-- Agenda: o que é marcado e não é aula
--
-- A aula já tem tabela (`class_sessions`) e regra própria — nasce da grade da
-- turma, uma de cada vez (0035). O que faltava era o resto do calendário da
-- escola: reunião pedagógica, conselho de classe, prova, recesso, evento
-- aberto. Tudo isso vinha sendo combinado fora do sistema, então a agenda de
-- quem dá aula nunca foi a agenda inteira.
--
-- Um evento pode ser de uma turma (`group_id`) ou da escola toda (`group_id`
-- nulo) — é essa distinção que decide quem enxerga e quem edita:
--
--   • admin      — tudo, sempre (§3.3: coordenação não tem teto).
--   • professor  — o que é da turma dele, mais o que a escola marcou para
--                  todos. Cria/edita/apaga só o que é da própria turma.
--   • aluno      — lê o que é da turma em que está matriculado e o que é da
--                  escola inteira. Nunca escreve.
--
-- `audience` é o segundo eixo: reunião de coordenação é da escola toda mas
-- não é assunto de aluno. A policy de leitura respeita isso — não é só a
-- interface que esconde.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'agenda_event_kind') then
    create type public.agenda_event_kind as enum (
      'meeting',   -- reunião (pedagógica, conselho, atendimento a responsáveis)
      'event',     -- evento da escola (feira, formatura, workshop)
      'exam',      -- prova / avaliação
      'holiday',   -- feriado ou recesso — não tem aula
      'reminder'   -- lembrete/marco sem sala e sem presença
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'agenda_audience') then
    create type public.agenda_audience as enum (
      'all',       -- todo mundo que alcança a turma/escola
      'staff',     -- coordenação e professores
      'students'   -- alunos (e a coordenação, que vê tudo)
    );
  end if;
end
$$;

create table if not exists public.agenda_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Nulo = escola inteira. É a diferença entre "reunião da turma B2 noite" e
  -- "recesso de julho".
  group_id uuid references public.groups (id) on delete cascade,
  -- Quem responde pelo compromisso. Para o professor é o próprio cadastro;
  -- para a coordenação pode ser nulo (é da escola, não de alguém).
  owner_id uuid references public.profiles (id) on delete set null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  kind public.agenda_event_kind not null default 'meeting',
  audience public.agenda_audience not null default 'all',
  title text not null check (length(btrim(title)) between 2 and 160),
  description text check (description is null or length(description) <= 2000),
  location text check (location is null or length(location) <= 160),
  starts_at timestamptz not null,
  -- Dia inteiro guarda a duração mesmo assim (1440) para o cálculo da agenda
  -- não precisar de dois caminhos; `all_day` só muda como o cartão é desenhado.
  duration_minutes integer not null default 60 check (duration_minutes between 5 and 1440),
  all_day boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A agenda sempre pergunta por janela de tempo dentro de uma organização.
create index if not exists agenda_events_org_starts_at
  on public.agenda_events (organization_id, starts_at);

-- Filtro por turma na barra lateral da agenda.
create index if not exists agenda_events_group_starts_at
  on public.agenda_events (group_id, starts_at)
  where group_id is not null;

create or replace function public.touch_agenda_event()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists agenda_events_touch on public.agenda_events;
create trigger agenda_events_touch
  before update on public.agenda_events
  for each row execute function public.touch_agenda_event();

alter table public.agenda_events enable row level security;

-- ------------------------------------------------------------- policies ----

-- Coordenação: tudo dentro da própria organização.
drop policy if exists agenda_events_all_admin on public.agenda_events;
create policy agenda_events_all_admin on public.agenda_events
  for all to authenticated
  using (organization_id = public.auth_org() and public.is_admin())
  with check (organization_id = public.auth_org() and public.is_admin());

-- Professor lê o que é da turma dele, o que ele criou e o que é da escola —
-- menos o que foi marcado só para alunos.
drop policy if exists agenda_events_select_teacher on public.agenda_events;
create policy agenda_events_select_teacher on public.agenda_events
  for select to authenticated
  using (
    organization_id = public.auth_org()
    and public.profile_role((select auth.uid())) = 'teacher'
    and audience <> 'students'
    and (
      group_id is null
      or public.teaches_group(group_id)
      or owner_id = (select auth.uid())
    )
  );

-- Escrita do professor: só o que é da própria turma. Evento da escola inteira
-- (`group_id` nulo) é decisão de coordenação, não dele.
drop policy if exists agenda_events_insert_teacher on public.agenda_events;
create policy agenda_events_insert_teacher on public.agenda_events
  for insert to authenticated
  with check (
    organization_id = public.auth_org()
    and public.profile_role((select auth.uid())) = 'teacher'
    and created_by = (select auth.uid())
    and group_id is not null
    and public.teaches_group(group_id)
  );

drop policy if exists agenda_events_update_teacher on public.agenda_events;
create policy agenda_events_update_teacher on public.agenda_events
  for update to authenticated
  using (
    organization_id = public.auth_org()
    and public.profile_role((select auth.uid())) = 'teacher'
    and group_id is not null
    and public.teaches_group(group_id)
  )
  with check (
    organization_id = public.auth_org()
    and group_id is not null
    and public.teaches_group(group_id)
  );

drop policy if exists agenda_events_delete_teacher on public.agenda_events;
create policy agenda_events_delete_teacher on public.agenda_events
  for delete to authenticated
  using (
    organization_id = public.auth_org()
    and public.profile_role((select auth.uid())) = 'teacher'
    and group_id is not null
    and public.teaches_group(group_id)
  );

-- Aluno: leitura, e só. Não há policy de escrita para ele em lugar nenhum
-- desta tabela — a ausência é a regra, não um esquecimento.
drop policy if exists agenda_events_select_student on public.agenda_events;
create policy agenda_events_select_student on public.agenda_events
  for select to authenticated
  using (
    organization_id = public.auth_org()
    and public.profile_role((select auth.uid())) = 'student'
    and audience <> 'staff'
    and (group_id is null or public.enrolled_in_group(group_id))
  );
