-- ---------------------------------------------------------------------------
-- Pastas do ateliê de tarefas + tarefa padrão compartilhada
--
-- Mesmo desenho de `lesson_plan_folders` (0035): a estante é de quem cria
-- (`owner_id`), pessoal — ninguém enxerga a estante do outro —, e apagar a
-- pasta desarquiva a tarefa padrão em vez de apagá-la (`on delete set null`).
--
-- `is_shared` entra junto porque, ao contrário da aula, a tarefa padrão nunca
-- teve esse recorte: a RLS só deixava dono (ou admin) enxergar, e a tela do
-- professor filtrava "minhas" na aplicação (0038). Isto replica o par que
-- `lesson_plans.is_shared` já tem — compartilhada passa a ser lida pela
-- escola inteira — sem mudar quem edita ou apaga (continua dono ou admin,
-- como a 0038 já definia).
-- ---------------------------------------------------------------------------

create table if not exists public.assignment_template_folders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Dono da estante. Cascade: professor removido leva junto as pastas dele,
  -- e as tarefas padrão voltam para "sem pasta" pelo `set null` lá embaixo.
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  -- Cor da etiqueta. Texto com check em vez de enum, mesma razão da 0035: a
  -- paleta da interface muda mais que o schema.
  color text not null default 'gold'
    check (color in ('gold', 'navy', 'emerald', 'violet', 'rose', 'slate')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Duas pastas "Gramática" na mesma estante seriam indistinguíveis na lista.
create unique index if not exists assignment_template_folders_owner_name_idx
  on public.assignment_template_folders (owner_id, lower(btrim(name)));

-- A tela sempre pede a estante de UMA pessoa, em ordem alfabética.
create index if not exists assignment_template_folders_owner_idx
  on public.assignment_template_folders (organization_id, owner_id, name);

create or replace function public.assignment_template_folders_touch_updated_at()
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

drop trigger if exists assignment_template_folders_set_updated_at on public.assignment_template_folders;
create trigger assignment_template_folders_set_updated_at
  before update on public.assignment_template_folders
  for each row
  execute function public.assignment_template_folders_touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: a estante é de quem a criou, mesmo desenho de `lesson_plan_folders`
-- (0035) — sem policy de organização de propósito, coordenação e professor da
-- mesma escola não leem a pasta um do outro. O planejador escreve por
-- service-role, e a posse é reconferida na action; estas policies são a rede
-- de baixo, para o caso de um client com a chave anônima chegar na tabela.
--
-- Já nasce com `auth.uid()`/`is_admin()`/`auth_org()` dentro de `(select ...)`
-- — ver 0044 — para não precisar de uma migration de performance depois.
-- ---------------------------------------------------------------------------
alter table public.assignment_template_folders enable row level security;

drop policy if exists assignment_template_folders_select_own on public.assignment_template_folders;
create policy assignment_template_folders_select_own
  on public.assignment_template_folders
  for select
  using (owner_id = (select auth.uid()));

drop policy if exists assignment_template_folders_insert_own on public.assignment_template_folders;
create policy assignment_template_folders_insert_own
  on public.assignment_template_folders
  for insert
  with check (
    owner_id = (select auth.uid())
    and organization_id = (select public.auth_org())
  );

drop policy if exists assignment_template_folders_update_own on public.assignment_template_folders;
create policy assignment_template_folders_update_own
  on public.assignment_template_folders
  for update
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and organization_id = (select public.auth_org())
  );

drop policy if exists assignment_template_folders_delete_own on public.assignment_template_folders;
create policy assignment_template_folders_delete_own
  on public.assignment_template_folders
  for delete
  using (owner_id = (select auth.uid()));

-- -------------------------------------------------------- tarefa padrão ----

alter table public.assignment_templates
  add column if not exists folder_id uuid
    references public.assignment_template_folders (id) on delete set null;

-- Parcial: a maioria das tarefas padrão nasce e morre sem pasta.
create index if not exists assignment_templates_folder_idx
  on public.assignment_templates (folder_id)
  where folder_id is not null;

alter table public.assignment_templates
  add column if not exists is_shared boolean not null default false;

-- A leitura ganha a exceção: compartilhada é visível para a escola inteira.
-- Escrita (insert/update/delete) não muda — continua dono ou admin (0038).
drop policy if exists assignment_templates_select on public.assignment_templates;
create policy assignment_templates_select
  on public.assignment_templates
  for select
  using (
    owner_id = (select auth.uid())
    or is_shared
    or (select public.is_admin())
  );
