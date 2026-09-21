-- Integração com o Google Agenda / Meet.
--
-- Tudo em tabelas próprias, fora de `class_sessions`, por dois motivos:
--   * `class_sessions` é a tabela que quase toda tela escuta em tempo real;
--     gravar id de evento nela acordaria a plataforma inteira à toa;
--   * o link do Meet do aluno só pode aparecer 30 min antes da aula. Se ele
--     morasse numa coluna legível pelo aluno, a regra seria contornável por
--     fora da interface.
--
-- Nenhuma policy: RLS ligada e sem policy é o que impede `authenticated` de
-- alcançar as tabelas. Quem lê e escreve é o service-role, depois de conferir
-- a posse (mesmo desenho de `class_session_locks`, 0042).

-- Uma conexão por usuário. O refresh token fica cifrado (AES-256-GCM) pela
-- aplicação; o banco nunca vê o valor em claro.
create table if not exists public.google_connections (
  profile_id        uuid primary key references public.profiles (id) on delete cascade,
  organization_id   uuid        not null references public.organizations (id) on delete cascade,
  refresh_token_enc text        not null,
  scope             text        not null,
  status            text        not null default 'active'
                    check (status in ('active', 'revoked')),
  connected_at      timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Evento criado por aula, por pessoa (professor e cada aluno têm o seu, na
-- própria agenda). `synced_start` diz para que horário o evento foi montado,
-- e evita um PATCH quando nada mudou.
create table if not exists public.google_event_links (
  session_id      uuid        not null references public.class_sessions (id) on delete cascade,
  profile_id      uuid        not null references public.profiles (id) on delete cascade,
  google_event_id text        not null,
  synced_start    timestamptz not null,
  synced_at       timestamptz not null default now(),
  primary key (session_id, profile_id)
);

create index if not exists google_event_links_profile_idx
  on public.google_event_links (profile_id);

-- Link do Meet da aula, criado na agenda do professor (anfitrião).
create table if not exists public.session_meet_links (
  session_id      uuid primary key references public.class_sessions (id) on delete cascade,
  host_profile_id uuid        not null references public.profiles (id) on delete cascade,
  meet_url        text        not null check (meet_url ~ '^https://'),
  created_at      timestamptz not null default now()
);

alter table public.google_connections enable row level security;
alter table public.google_event_links enable row level security;
alter table public.session_meet_links enable row level security;
