-- Prova de consentimento (LGPD art. 7 I, art. 8 §1 e §2).
--
-- Uma linha por decisão: cookies do banner, aceite dos termos no cadastro,
-- autorização de contato nos formulários públicos. Append-only — revogar é
-- inserir uma linha nova com `granted = false`, para o histórico mostrar o que
-- valia em cada data.
--
-- `consent_id` liga as escolhas de cookies de um mesmo navegador (visitante
-- sem conta não tem `subject_id` nem e-mail). `subject_id` vira NULL se o
-- perfil for apagado; a anonimização do titular também deve limpar
-- `subject_email`, `ip_address` e `user_agent` das linhas dele.
--
-- Nenhuma policy: RLS ligada e sem policy impede `authenticated`/`anon` de
-- ler ou escrever. Só o service-role grava (mesmo desenho de `audit_logs`).

create table if not exists public.consent_records (
  id               bigint generated always as identity primary key,
  organization_id  uuid        not null references public.organizations (id) on delete cascade,
  purpose          text        not null
                   check (purpose in ('cookies', 'contact_form', 'trial_class', 'terms_and_privacy')),
  granted          boolean     not null,
  document_version text        not null,
  choices          jsonb       not null default '{}'::jsonb,
  subject_id       uuid        references public.profiles (id) on delete set null,
  subject_email    text,
  consent_id       text,
  ip_address       inet,
  user_agent       text,
  created_at       timestamptz not null default now()
);

create index if not exists consent_records_subject_idx
  on public.consent_records (subject_id, purpose, created_at desc)
  where subject_id is not null;

create index if not exists consent_records_email_idx
  on public.consent_records (lower(subject_email), purpose, created_at desc)
  where subject_email is not null;

create index if not exists consent_records_consent_id_idx
  on public.consent_records (consent_id, created_at desc)
  where consent_id is not null;

alter table public.consent_records enable row level security;

revoke all on public.consent_records from anon, authenticated;
