-- ---------------------------------------------------------------------------
-- Tarefas padrão (ateliê de tarefas)
--
-- Até aqui toda tarefa nascia direto numa turma — sem lugar para montar um
-- exercício e decidir depois para quem vai, como já existe para aula
-- (`lesson_plans`, 0016-ish). Esta tabela é esse ateliê: o professor monta o
-- exercício uma vez, guarda como "tarefa padrão", e manda para uma ou mais
-- turmas quando quiser.
--
-- Atribuir continua funcionando do jeito que já funciona: cada turma escolhida
-- vira sua própria linha em `assignments`, com entrega e nota independentes —
-- nada disso muda. `assignments.template_id` só marca de qual tarefa padrão
-- aquela linha nasceu, pra saber quais turmas já receberam cada uma.
-- ---------------------------------------------------------------------------

create table if not exists public.assignment_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 2 and 200),
  -- Mesmo formato de `assignments.instructions`/`answer_key`: enunciado e
  -- questões já no formato final — atribuir a uma turma é só copiar as duas
  -- colunas, sem reprocessar nada.
  instructions jsonb,
  answer_key jsonb,
  max_score numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A tela sempre pede a estante de UMA pessoa (ou a escola inteira, se admin).
create index if not exists assignment_templates_owner_idx
  on public.assignment_templates (organization_id, owner_id, created_at desc);

create or replace function public.assignment_templates_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists assignment_templates_set_updated_at on public.assignment_templates;
create trigger assignment_templates_set_updated_at
  before update on public.assignment_templates
  for each row
  execute function public.assignment_templates_touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: mesmo desenho de `lesson_plan_folders` — dono da tarefa padrão, ou
-- admin da escola. O "rede de baixo" continua sendo o service-role + a
-- action; isto aqui é só o que sobra para um client com a chave anônima.
-- ---------------------------------------------------------------------------
alter table public.assignment_templates enable row level security;

drop policy if exists assignment_templates_select on public.assignment_templates;
create policy assignment_templates_select
  on public.assignment_templates
  for select
  using (owner_id = auth.uid() or public.is_admin());

drop policy if exists assignment_templates_insert on public.assignment_templates;
create policy assignment_templates_insert
  on public.assignment_templates
  for insert
  with check (owner_id = auth.uid() and organization_id = public.auth_org());

drop policy if exists assignment_templates_update on public.assignment_templates;
create policy assignment_templates_update
  on public.assignment_templates
  for update
  using (owner_id = auth.uid() or public.is_admin())
  with check (organization_id = public.auth_org());

drop policy if exists assignment_templates_delete on public.assignment_templates;
create policy assignment_templates_delete
  on public.assignment_templates
  for delete
  using (owner_id = auth.uid() or public.is_admin());

-- Rastro: de qual tarefa padrão esta linha (turma) nasceu, se nasceu de
-- alguma — `assignments` criadas direto (sem passar pelo ateliê) ficam nulas.
alter table public.assignments
  add column if not exists template_id uuid
    references public.assignment_templates (id) on delete set null;

create index if not exists assignments_template_idx
  on public.assignments (template_id)
  where template_id is not null;
