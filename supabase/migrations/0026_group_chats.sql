-- ---------------------------------------------------------------------------
-- Chat de turma
--
-- Cada turma tem exatamente uma conversa (`conversations.type = 'group'`),
-- criada e mantida pelo próprio banco: designar um professor a uma turma ou
-- matricular um aluno já entra no chat, sem passo manual na aplicação.
--
-- O professor (e o admin) pode fechar o chat para alunos — `students_can_post`
-- é lido pela policy de INSERT em `messages`, não só pela interface: aluno com
-- o chat trancado não escreve nem chamando a API direto.
-- ---------------------------------------------------------------------------

alter table public.conversations
  add column if not exists students_can_post boolean not null default true,
  add column if not exists posting_changed_by uuid references public.profiles (id),
  add column if not exists posting_changed_at timestamptz;

-- Uma conversa por turma. Índice parcial porque `group_id` é null nas DMs.
create unique index if not exists conversations_one_per_group
  on public.conversations (group_id)
  where type = 'group';

-- ----------------------------------------------------------------- helpers --

/**
 * Papel lido de `profiles`, não do JWT. `auth_role()` depende da claim
 * `app_role` do custom access token hook e cai em 'student' quando ela não
 * existe — o que aqui significaria trancar o admin fora do próprio chat.
 */
create or replace function public.profile_role(p_id uuid)
returns public.app_role
language sql
stable
security definer
set search_path to ''
as $$
  select p.role from public.profiles p where p.id = p_id;
$$;

/** Trava de postagem: alunos calam quando o chat da turma está fechado. */
create or replace function public.can_post_in_conversation(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.conversations c
    where c.id = p_conversation_id
      and (
        c.type <> 'group'
        or c.students_can_post
        or public.profile_role(auth.uid()) <> 'student'
      )
  );
$$;

-- ------------------------------------------------------- sincronização ------

/**
 * Cria (se faltar) o chat da turma e reconcilia a lista de participantes com
 * a realidade: o professor responsável de agora e os alunos com matrícula
 * ativa. Idempotente de propósito — é chamada por gatilho a cada mudança e
 * também no backfill.
 */
create or replace function public.ensure_group_conversation(p_group_id uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_group record;
  v_conversation_id uuid;
begin
  select g.id, g.organization_id, g.teacher_id
    into v_group
    from public.groups g
   where g.id = p_group_id;

  if not found then
    return null;
  end if;

  select c.id
    into v_conversation_id
    from public.conversations c
   where c.group_id = p_group_id and c.type = 'group';

  if v_conversation_id is null then
    insert into public.conversations (organization_id, type, group_id, created_by)
    values (v_group.organization_id, 'group', p_group_id, v_group.teacher_id)
    returning id into v_conversation_id;
  end if;

  -- Professor anterior sai junto com a reatribuição da turma.
  delete from public.conversation_participants cp
   using public.profiles p
   where cp.conversation_id = v_conversation_id
     and cp.profile_id = p.id
     and p.role = 'teacher'
     and p.id <> v_group.teacher_id;

  insert into public.conversation_participants (conversation_id, profile_id)
  values (v_conversation_id, v_group.teacher_id)
  on conflict do nothing;

  insert into public.conversation_participants (conversation_id, profile_id)
  select v_conversation_id, e.student_id
    from public.enrollments e
   where e.group_id = p_group_id and e.status = 'active'
  on conflict do nothing;

  -- Aluno que saiu da turma perde o acesso ao histórico do chat.
  delete from public.conversation_participants cp
   where cp.conversation_id = v_conversation_id
     and cp.profile_id <> v_group.teacher_id
     and exists (
       select 1 from public.profiles p
        where p.id = cp.profile_id and p.role = 'student'
     )
     and not exists (
       select 1 from public.enrollments e
        where e.group_id = p_group_id
          and e.student_id = cp.profile_id
          and e.status = 'active'
     );

  return v_conversation_id;
end;
$$;

create or replace function public.sync_group_conversation()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform public.ensure_group_conversation(new.id);
  return new;
end;
$$;

drop trigger if exists groups_sync_conversation on public.groups;
create trigger groups_sync_conversation
  after insert or update of teacher_id on public.groups
  for each row execute function public.sync_group_conversation();

create or replace function public.sync_enrollment_conversation()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.ensure_group_conversation(old.group_id);
    return old;
  end if;

  perform public.ensure_group_conversation(new.group_id);

  -- Troca de turma: o chat de origem também precisa perder o aluno.
  if tg_op = 'UPDATE' and old.group_id is distinct from new.group_id then
    perform public.ensure_group_conversation(old.group_id);
  end if;

  return new;
end;
$$;

drop trigger if exists enrollments_sync_conversation on public.enrollments;
create trigger enrollments_sync_conversation
  after insert or update or delete on public.enrollments
  for each row execute function public.sync_enrollment_conversation();

-- -------------------------------------------------------------- policies ----

drop policy if exists messages_insert_participant on public.messages;
create policy messages_insert_participant on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_conversation_participant(conversation_id)
    and public.can_post_in_conversation(conversation_id)
  );

-- Professor modera o próprio chat: apaga (soft delete) mensagem de aluno.
drop policy if exists messages_update_group_teacher on public.messages;
create policy messages_update_group_teacher on public.messages
  for update to authenticated
  using (
    exists (
      select 1 from public.conversations c
       where c.id = messages.conversation_id
         and c.group_id is not null
         and public.teaches_group(c.group_id)
    )
  )
  with check (
    exists (
      select 1 from public.conversations c
       where c.id = messages.conversation_id
         and c.group_id is not null
         and public.teaches_group(c.group_id)
    )
  );

-- --------------------------------------------------------------- overview ---

/**
 * Painel de chats numa chamada só. Feito como função porque o resumo precisa
 * de "última mensagem por conversa" e "não lidas desde o meu last_read_at" —
 * duas coisas que via PostgREST viravam uma query por turma (§10.1).
 */
create or replace function public.group_chat_overview()
returns table (
  conversation_id uuid,
  group_id uuid,
  group_name text,
  level public.cefr_level,
  is_active boolean,
  teacher_id uuid,
  teacher_name text,
  member_count int,
  students_can_post boolean,
  last_message_at timestamptz,
  last_message_body text,
  last_message_sender text,
  unread_count int
)
language sql
stable
security definer
set search_path to ''
as $$
  with me as (
    select
      auth.uid() as uid,
      public.profile_role(auth.uid()) as role,
      (select p.organization_id from public.profiles p where p.id = auth.uid()) as org
  ),
  visible as (
    select c.id, c.group_id, c.students_can_post, c.last_message_at
      from public.conversations c, me
     where c.type = 'group'
       and c.group_id is not null
       and c.organization_id = me.org
       and (
         me.role = 'admin'
         or exists (
           select 1 from public.conversation_participants cp
            where cp.conversation_id = c.id and cp.profile_id = me.uid
         )
       )
  )
  select
    v.id,
    g.id,
    g.name,
    g.level,
    g.is_active,
    t.id,
    t.full_name,
    (select count(*)::int
       from public.conversation_participants cp
      where cp.conversation_id = v.id),
    v.students_can_post,
    v.last_message_at,
    case when lm.deleted_at is not null then null else lm.body end,
    sender.full_name,
    case
      when mine.profile_id is null then 0
      else (
        select count(*)::int
          from public.messages m
         where m.conversation_id = v.id
           and m.sender_id <> (select uid from me)
           and m.deleted_at is null
           and m.created_at > coalesce(mine.last_read_at, '-infinity'::timestamptz)
      )
    end
  from visible v
  join public.groups g on g.id = v.group_id
  join public.profiles t on t.id = g.teacher_id
  left join public.conversation_participants mine
    on mine.conversation_id = v.id and mine.profile_id = (select uid from me)
  left join lateral (
    select m.body, m.sender_id, m.deleted_at
      from public.messages m
     where m.conversation_id = v.id
     order by m.created_at desc
     limit 1
  ) lm on true
  left join public.profiles sender on sender.id = lm.sender_id
  order by v.last_message_at desc nulls last, g.name;
$$;

grant execute on function public.group_chat_overview() to authenticated;

-- ---------------------------------------------------------------- realtime --

-- `conversations` entra na publicação para que trancar/destrancar o chat
-- apareça na tela de quem já está com ele aberto, sem refresh.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;
end;
$$;

-- ---------------------------------------------------------------- backfill --

select public.ensure_group_conversation(g.id) from public.groups g;
