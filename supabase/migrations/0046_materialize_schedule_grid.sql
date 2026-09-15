-- A grade da semana volta a existir como aula pendente.
--
-- A 0035 passou a materializar SÓ a próxima ocorrência de cada turma. O efeito
-- colateral apareceu em produção: como existia uma única linha real por turma
-- — às vezes semanas à frente — o professor que ia dar a aula do dia clicava
-- em "Dar aula" na única linha disponível e encerrava a ocorrência ERRADA.
-- Três aulas de 15/09, 22/09 e 29/09 nasceram "Concluída" tendo sido dadas em
-- 31/08 e 03/09. Nada marca sessão como concluída sozinho (só `endSession`);
-- o que faltava era a aula do dia existir para ser clicada.
--
-- Volta a janela rolante: toda ocorrência da grade nos próximos 28 dias vira
-- linha `scheduled`. Quem muda o status continua sendo gente — "Dar aula" até
-- `completed`, "Cancelar" até `cancelled`.
--
-- O que a 0035 acertou e fica de pé: ocorrência que já tem linha não volta,
-- então cancelar ou remarcar uma aula não faz o cron das 03:00 recriá-la de
-- madrugada no mesmo horário.

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
  horizon date := current_date + 28;
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

        continue when exists (
          select 1 from public.class_sessions cs
          where cs.group_id = g.id and cs.scheduled_at = occurrence
        );

        insert into public.class_sessions (
          organization_id, group_id, teacher_id, title, scheduled_at, duration_minutes, status
        ) values (
          g.organization_id, g.id, g.teacher_id, g.name, occurrence,
          duration_min, 'scheduled'
        );
        inserted_count := inserted_count + 1;
      end loop;
    end loop;
  end loop;

  return inserted_count;
end;
$function$;

select public.generate_recurring_sessions();
