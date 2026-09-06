-- Aula por aula, não o mês inteiro.
--
-- `generate_recurring_sessions` materializava 28 dias de grade de uma vez: a
-- turma nascia com nove aulas no banco e o mês inteiro virava fato consumado.
-- Trocar de horário, pular uma semana ou fechar por feriado obrigava a mexer
-- em série. Agora a função materializa SÓ a próxima ocorrência de cada turma,
-- e a seguinte só entra quando a anterior sai do caminho (foi dada, cancelada
-- ou remarcada). O resto do mês é prévia calculada da grade, não linha no
-- banco — ver `src/lib/schedule/session-preview.ts`.
--
-- O cron das 03:00 continua o mesmo e vira rede de segurança: se o professor
-- não marcar a próxima ao encerrar a aula, a turma não amanhece sem agenda.

create or replace function public.generate_recurring_sessions(p_group_id uuid default null)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  g record;
  entry jsonb;
  weekday int;
  start_t time;
  end_t time;
  duration_min int;
  d date;
  occurrence timestamptz;
  next_at timestamptz;
  next_duration int;
  -- Turma com uma aula por mês (ou parada por férias) também tem que achar a
  -- próxima; a janela é larga porque se procura UMA ocorrência, não a série.
  horizon date := current_date + 120;
  inserted_count integer := 0;
begin
  for g in
    select gr.id, gr.organization_id, gr.teacher_id, gr.name, gr.schedule,
           gr.start_date, gr.end_date, o.timezone as org_timezone
    from public.groups gr
    join public.organizations o on o.id = gr.organization_id
    where gr.is_active = true
      and (p_group_id is null or gr.id = p_group_id)
  loop
    -- Já existe aula viva à frente: a próxima está marcada, nada a fazer.
    -- É esta checagem que troca "o mês inteiro" por "uma de cada vez".
    continue when exists (
      select 1 from public.class_sessions cs
      where cs.group_id = g.id
        and cs.scheduled_at > now()
        and cs.status in ('scheduled', 'in_progress')
    );

    next_at := null;
    next_duration := null;

    for entry in select * from jsonb_array_elements(g.schedule)
    loop
      weekday := (entry->>'weekday')::int;
      start_t := (entry->>'start')::time;
      end_t := (entry->>'end')::time;
      duration_min := greatest((extract(epoch from (end_t - start_t)) / 60)::int, 1);

      for d in
        select gs::date from generate_series(current_date, horizon, interval '1 day') gs
        where extract(dow from gs) = weekday
      loop
        continue when g.start_date is not null and d < g.start_date;
        continue when g.end_date is not null and d > g.end_date;

        occurrence := (d + start_t) at time zone g.org_timezone;
        continue when occurrence <= now();

        -- Ocorrência que já tem linha (dada, cancelada, remarcada para outro
        -- dia) não volta: cancelar uma aula não pode fazer o cron recriá-la
        -- de madrugada no mesmo horário.
        continue when exists (
          select 1 from public.class_sessions cs
          where cs.group_id = g.id and cs.scheduled_at = occurrence
        );

        if next_at is null or occurrence < next_at then
          next_at := occurrence;
          next_duration := duration_min;
        end if;

        -- Achou a primeira data livre deste horário da grade; as semanas
        -- seguintes dele não interessam agora.
        exit;
      end loop;
    end loop;

    if next_at is not null then
      insert into public.class_sessions (
        organization_id, group_id, teacher_id, title, scheduled_at, duration_minutes, status
      ) values (
        g.organization_id, g.id, g.teacher_id, g.name, next_at,
        greatest(coalesce(next_duration, 60), 1), 'scheduled'
      );
      inserted_count := inserted_count + 1;
    end if;
  end loop;

  return inserted_count;
end;
$function$;

-- O aluno passa a enxergar a aula MARCADA, não só o registro publicado.
--
-- A policy antiga exigia `is_published = true`, que só é ligado ao encerrar a
-- aula: a "próxima aula" do painel do aluno vinha vazia e a agenda dele era,
-- na prática, o passado. Com uma aula futura por turma isso ficaria absurdo —
-- ele veria a prévia calculada e nunca a data confirmada.
--
-- O que abre é só o que está `scheduled`: título e horário, com `content`
-- ainda vazio e `teacher_notes` sem SELECT para `authenticated` (migration
-- 0015). Aula em andamento e registro não publicado continuam fechados.
drop policy if exists class_sessions_select_student on public.class_sessions;
create policy class_sessions_select_student on public.class_sessions
for select to authenticated
using (
  organization_id = public.auth_org()
  and public.enrolled_in_group(group_id)
  and (is_published = true or status = 'scheduled')
);

-- Limpeza do que a versão antiga já espalhou pelo calendário: de cada turma
-- fica a aula futura mais próxima; as demais saem — mas só as INTOCADAS
-- (sem plano, sem conteúdo escrito, sem chamada, sem PDF, nunca iniciadas).
-- Qualquer sessão com trabalho em cima dela permanece onde está.
with ranked as (
  select
    cs.id,
    row_number() over (partition by cs.group_id order by cs.scheduled_at) as pos,
    (
      cs.started_at is null
      and cs.lesson_plan_id is null
      and cs.pdf_path is null
      and cs.is_published = false
      and cs.teacher_notes is null
      and cs.homework is null
      and cs.content = '{"type": "doc", "content": []}'::jsonb
      and not exists (select 1 from public.attendance a where a.session_id = cs.id)
      and not exists (
        select 1 from public.session_content_versions v where v.session_id = cs.id
      )
    ) as untouched
  from public.class_sessions cs
  where cs.status = 'scheduled' and cs.scheduled_at > now()
)
delete from public.class_sessions target
using ranked
where target.id = ranked.id
  and ranked.pos > 1
  and ranked.untouched;
