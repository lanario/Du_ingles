-- ---------------------------------------------------------------------------
-- Convites de cadastro por WhatsApp.
--
-- Até aqui o admin criava a conta inteira (`createUser`) e ditava uma senha
-- provisória. O fluxo novo inverte: o admin só reserva o papel e o número,
-- e quem preenche nome, e-mail, nascimento, CPF e senha é o próprio
-- convidado — a conta em `auth.users` nasce no aceite, não no convite.
--
-- Consequência de modelagem: o convite NÃO é um profile incompleto. Ele
-- vive na própria tabela, com token de uso único e validade, e só vira
-- profile quando aceito. Assim um convite expirado ou revogado nunca deixa
-- usuário órfão em `auth.users` nem linha morta em `profiles`.
--
-- Rodar no SQL Editor do projeto Supabase da Du Inglês.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- CPF passa a ser dado do cadastro (obrigatório no aceite do convite, nulo
-- para as contas que já existiam). Guardado só em dígitos: máscara é
-- assunto de apresentação, e comparar "111.444.777-35" com "11144477735"
-- seria uma fonte infinita de duplicata.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists cpf text;

alter table public.profiles
  drop constraint if exists profiles_cpf_digits;

alter table public.profiles
  add constraint profiles_cpf_digits
  check (cpf is null or cpf ~ '^[0-9]{11}$');

-- Único por organização, ignorando os excluídos: um CPF não pode ter duas
-- contas ativas na mesma escola, mas pode voltar depois de um soft delete.
create unique index if not exists profiles_org_cpf_key
  on public.profiles (organization_id, cpf)
  where cpf is not null and deleted_at is null;

-- ---------------------------------------------------------------------------
-- Convites
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_invite_status') then
    create type public.user_invite_status as enum (
      -- Enviado, ainda dentro da validade e sem uso.
      'pending',
      -- Virou conta. `accepted_profile_id` aponta para ela.
      'accepted',
      -- Cancelado pelo admin (ou substituído por um reenvio).
      'revoked'
    );
  end if;
end
$$;

create table if not exists public.user_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Papel que a conta terá no aceite. É a "especificação" do convite: o
  -- convidado não escolhe se é aluno, professor ou admin.
  role public.app_role not null,
  -- Nome de referência digitado pelo admin. Pré-preenche o cadastro e
  -- personaliza a mensagem do WhatsApp; o convidado ainda pode corrigir.
  full_name text not null,
  -- Só dígitos, com DDI: 5521999998888. É o número que recebe o link.
  phone text not null check (phone ~ '^[0-9]{10,15}$'),
  -- Nunca guardamos o token em claro: quem lê a tabela (backup, dump,
  -- service-role vazada) não consegue se passar por um convidado.
  token_hash text not null unique,
  status public.user_invite_status not null default 'pending',
  expires_at timestamptz not null,
  created_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  accepted_profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A listagem do painel sempre filtra organização e ordena por mais recente.
create index if not exists user_invites_org_status_created_idx
  on public.user_invites (organization_id, status, created_at desc);

-- Um convite pendente por número, por organização. O reenvio revoga o
-- anterior antes de inserir (ver `repositories/invites.ts`), então este
-- índice barra duplicata acidental sem impedir reenvio legítimo.
create unique index if not exists user_invites_pending_phone_key
  on public.user_invites (organization_id, phone)
  where status = 'pending';

create or replace function public.user_invites_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_invites_set_updated_at on public.user_invites;

create trigger user_invites_set_updated_at
  before update on public.user_invites
  for each row
  execute function public.user_invites_touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: o admin da organização enxerga os convites que emitiu. Escrita não
-- tem policy nenhuma — criar, revogar e aceitar passam pelo service-role
-- nas server actions, porque o aceite acontece SEM sessão (o convidado
-- ainda não é usuário). Dar insert/update a `anon` aqui seria abrir a
-- criação de contas para a internet.
-- ---------------------------------------------------------------------------
alter table public.user_invites enable row level security;

drop policy if exists user_invites_admin_select on public.user_invites;

create policy user_invites_admin_select
  on public.user_invites
  for select
  using (public.is_admin() and organization_id = public.auth_org());
