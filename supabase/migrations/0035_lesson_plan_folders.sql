-- ---------------------------------------------------------------------------
-- Pastas do ateliê
--
-- O ateliê era uma grade única: toda aula da escola no mesmo monte, separada
-- só pela busca. Com dezenas de planos isso deixa de funcionar — daí as
-- pastas.
--
-- São dois recortes diferentes e de propósito:
--
-- * "Compartilhadas" e "Privadas" NÃO viram pasta. Continuam sendo leitura de
--   `is_shared` + autoria, calculadas na tela: são filtros, e um plano
--   compartilhado ainda pode estar arquivado numa pasta pessoal.
-- * As pastas desta tabela são a estante de cada um (`owner_id`): quem cria,
--   nomeia e pinta. Ninguém enxerga a estante do outro, mesmo compartilhando
--   o plano que está dentro dela.
--
-- Por isso `lesson_plans.folder_id` é `on delete set null`: apagar a pasta
-- desarquiva as aulas, nunca as apaga.
-- ---------------------------------------------------------------------------

create table if not exists public.lesson_plan_folders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Dono da estante. Cascade: professor removido leva junto as pastas dele,
  -- e os planos voltam para "sem pasta" pelo `set null` lá embaixo.
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  -- Cor da etiqueta. Texto com check em vez de enum: a paleta da interface
  -- muda mais que o schema, e enum novo em Postgres é migration.
  color text not null default 'gold'
    check (color in ('gold', 'navy', 'emerald', 'violet', 'rose', 'slate')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Duas pastas "Gramática" na mesma estante seriam indistinguíveis na lista.
create unique index if not exists lesson_plan_folders_owner_name_idx
  on public.lesson_plan_folders (owner_id, lower(btrim(name)));

-- A tela sempre pede a estante de UMA pessoa, em ordem alfabética.
create index if not exists lesson_plan_folders_owner_idx
  on public.lesson_plan_folders (organization_id, owner_id, name);

create or replace function public.lesson_plan_folders_touch_updated_at()
returns trigger
language plpgsql
-- search_path travado: a função roda em trigger de tabela com RLS.
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists lesson_plan_folders_set_updated_at on public.lesson_plan_folders;
create trigger lesson_plan_folders_set_updated_at
  before update on public.lesson_plan_folders
  for each row
  execute function public.lesson_plan_folders_touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: a estante é de quem a criou. Não há política de organização aqui de
-- propósito — coordenação e professor da mesma escola não leem a pasta um do
-- outro. O planejador escreve por service-role, e a posse é reconferida na
-- action; estas políticas são a rede de baixo, para o caso de um client com a
-- chave anônima chegar na tabela.
-- ---------------------------------------------------------------------------
alter table public.lesson_plan_folders enable row level security;

drop policy if exists lesson_plan_folders_select_own on public.lesson_plan_folders;
create policy lesson_plan_folders_select_own
  on public.lesson_plan_folders
  for select
  using (owner_id = auth.uid());

drop policy if exists lesson_plan_folders_insert_own on public.lesson_plan_folders;
create policy lesson_plan_folders_insert_own
  on public.lesson_plan_folders
  for insert
  with check (owner_id = auth.uid() and organization_id = public.auth_org());

drop policy if exists lesson_plan_folders_update_own on public.lesson_plan_folders;
create policy lesson_plan_folders_update_own
  on public.lesson_plan_folders
  for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and organization_id = public.auth_org());

drop policy if exists lesson_plan_folders_delete_own on public.lesson_plan_folders;
create policy lesson_plan_folders_delete_own
  on public.lesson_plan_folders
  for delete
  using (owner_id = auth.uid());

-- --------------------------------------------------------------------- plano

alter table public.lesson_plans
  add column if not exists folder_id uuid
    references public.lesson_plan_folders (id) on delete set null;

-- Parcial: a maioria dos planos nasce e morre sem pasta.
create index if not exists lesson_plans_folder_idx
  on public.lesson_plans (folder_id)
  where folder_id is not null;
