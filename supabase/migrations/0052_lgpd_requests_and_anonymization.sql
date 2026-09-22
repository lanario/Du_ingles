-- LGPD L-01 e L-02 (docs/lgpd-plano-de-adequacao.md).
--
-- 1. `lgpd_requests`: todo pedido de titular vira uma linha com protocolo e
--    prazo (art. 19: 15 dias). Sem isso o pedido só existia como um aviso no
--    sino, e sumia se ninguém visse.
-- 2. `anonymize_profile()`: a eliminação de verdade. Troca o identificador
--    por um marcador e apaga o que só serve para identificar a pessoa,
--    preservando o que tem guarda legal ou contratual (frequência, notas,
--    assinaturas, lançamentos financeiros — art. 16, I).
--
-- Por que anonimizar e não apagar a conta: `profiles.id` referencia
-- `auth.users` com ON DELETE CASCADE, e frequência, entregas, objetivos e
-- assinaturas caem em cascata a partir de `profiles`. Apagar o usuário do
-- auth destruiria exatamente o histórico que a lei manda guardar. O login é
-- neutralizado pela aplicação (e-mail trocado, senha aleatória, banimento).

-- ------------------------------------------------------------ requisições --

create sequence if not exists public.lgpd_request_protocol_seq;

create table if not exists public.lgpd_requests (
  id              uuid        primary key default gen_random_uuid(),
  protocol        text        not null unique
                  default ('LGPD-' || to_char(now(), 'YYYY') || '-' ||
                           lpad(nextval('public.lgpd_request_protocol_seq')::text, 4, '0')),
  organization_id uuid        not null references public.organizations (id) on delete cascade,
  requester_id    uuid        references public.profiles (id) on delete set null,
  requester_name  text        not null,
  requester_email text        not null,
  kind            text        not null check (kind in (
                    'access', 'rectification', 'deletion', 'sharing_info',
                    'consent_withdrawal', 'automated_review', 'other'
                  )),
  status          text        not null default 'open' check (status in (
                    'open', 'in_progress', 'fulfilled', 'partially_fulfilled',
                    'rejected', 'canceled'
                  )),
  details         text        check (char_length(details) <= 2000),
  due_at          timestamptz not null default (now() + interval '15 days'),
  handled_by      uuid        references public.profiles (id) on delete set null,
  resolution      text        check (char_length(resolution) <= 2000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  resolved_at     timestamptz
);

create index if not exists lgpd_requests_queue_idx
  on public.lgpd_requests (organization_id, status, due_at);

create index if not exists lgpd_requests_requester_idx
  on public.lgpd_requests (requester_id, created_at desc)
  where requester_id is not null;

-- Um pedido aberto por tipo e por titular: repetir o clique não cria fila.
create unique index if not exists lgpd_requests_one_open_per_kind
  on public.lgpd_requests (requester_id, kind)
  where requester_id is not null and status in ('open', 'in_progress');

drop trigger if exists set_updated_at on public.lgpd_requests;
create trigger set_updated_at before update on public.lgpd_requests
  for each row execute function public.set_updated_at();

-- Sem policy: só o service-role lê e escreve (mesmo desenho de audit_logs).
alter table public.lgpd_requests enable row level security;
revoke all on public.lgpd_requests from anon, authenticated;
revoke all on sequence public.lgpd_request_protocol_seq from anon, authenticated;

-- --------------------------------------------------------- anonimização --

alter table public.profiles
  add column if not exists anonymized_at timestamptz;

/**
 * Tudo numa transação: ou a pessoa sai inteira, ou nada muda. Devolve o
 * e-mail e o avatar ANTIGOS, que a aplicação ainda precisa para limpar o
 * que mora fora do banco (arquivo do avatar, conta de login, leads por
 * e-mail já foram tratados aqui).
 */
create or replace function public.anonymize_profile(p_profile_id uuid)
returns table (old_email text, old_avatar_path text, teacher_note_sessions integer)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_email  text;
  v_avatar text;
  v_notes  integer;
  v_marker text := 'removido+' || replace(p_profile_id::text, '-', '') || '@anonimizado.invalid';
begin
  select p.email::text, p.avatar_url
    into v_email, v_avatar
    from profiles p
   where p.id = p_profile_id and p.anonymized_at is null
   for update;

  if not found then
    raise exception 'profile % não existe ou já foi anonimizado', p_profile_id
      using errcode = 'P0002';
  end if;

  update profiles set
    full_name     = 'Titular removido',
    email         = v_marker,
    phone         = null,
    cpf           = null,
    birth_date    = null,
    avatar_url    = null,
    last_seen_at  = null,
    is_active     = false,
    deleted_at    = coalesce(deleted_at, now()),
    anonymized_at = now()
  where id = p_profile_id;

  update student_profiles set
    guardian_name = null, guardian_email = null, guardian_phone = null,
    goals = null, notes = null
  where profile_id = p_profile_id;

  update teacher_profiles set
    bio = null, certifications = '{}', specialties = '{}',
    hourly_rate = null, is_public = false
  where profile_id = p_profile_id;

  -- Nota e data da entrega ficam (histórico pedagógico); o texto que a
  -- pessoa escreveu sai, porque pode identificá-la.
  update assignment_submissions set content = null, answers = null
  where student_id = p_profile_id;

  -- A conversa dos colegas continua legível; o que ela escreveu, não.
  update messages set body = '[mensagem removida a pedido do titular]'
  where sender_id = p_profile_id;

  delete from notifications   where recipient_id = p_profile_id;
  delete from agenda_events   where owner_id = p_profile_id;
  delete from google_event_links where profile_id = p_profile_id;
  delete from google_connections where profile_id = p_profile_id;

  update user_invites set full_name = 'Titular removido', phone = '-'
  where accepted_profile_id = p_profile_id;

  -- Pedidos de contato feitos antes de virar aluno.
  delete from leads where lower(email::text) = lower(v_email);

  -- A prova de consentimento fica (é dela que depende demonstrar que o
  -- tratamento foi lícito), mas sem o que identifica a pessoa.
  update consent_records set subject_email = null, ip_address = null, user_agent = null
  where subject_id = p_profile_id or lower(subject_email) = lower(v_email);

  update lgpd_requests set requester_name = 'Titular removido', requester_email = v_marker
  where requester_id = p_profile_id;

  -- Observações de aula citam alunos pelo nome em texto livre: não há como
  -- limpar isso automaticamente sem apagar o registro do professor. A
  -- contagem vai para a tela, para revisão humana.
  select count(*)::integer into v_notes
    from class_sessions cs
   where cs.teacher_notes is not null
     and cs.group_id in (select e.group_id from enrollments e where e.student_id = p_profile_id);

  return query select v_email, v_avatar, v_notes;
end;
$fn$;

revoke all on function public.anonymize_profile(uuid) from public, anon, authenticated;
grant execute on function public.anonymize_profile(uuid) to service_role;
