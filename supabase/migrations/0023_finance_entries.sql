-- ---------------------------------------------------------------------------
-- Lançamentos financeiros da escola.
--
-- O painel precisava de receita e DRE, e não havia nenhuma origem de dinheiro
-- no schema. Em vez de espalhar preço por `groups`/`enrollments` (que só
-- cobriria receita, e ainda por cima só a recorrente), a escolha é uma tabela
-- única de lançamentos: receita, custo profissional e despesa operacional
-- entram pela mesma porta e o sinal vem do `kind`, não do valor.
--
-- Aplicada em 18/08/2026 no projeto 'Du Ingles' (qxkqndnvacwoqnvofsth).
-- ---------------------------------------------------------------------------

create type public.finance_entry_kind as enum (
  -- Entra dinheiro: mensalidade, matrícula, material, aula avulsa.
  'revenue',
  -- Sai dinheiro ligado à entrega da aula: cachê/salário de professor.
  'professional_cost',
  -- Sai dinheiro de estrutura: aluguel, software, marketing, contador.
  'operating_expense'
);

create table public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind public.finance_entry_kind not null,
  description text not null,
  -- Centavos inteiros. `numeric` resolveria a precisão, mas obriga todo o
  -- caminho TS a tratar string; centavo em bigint mantém o valor exato e
  -- somável em JS até muito além do faturamento de uma escola.
  amount_cents bigint not null check (amount_cents > 0),
  -- Competência, não data de digitação: é por ela que o DRE fecha o mês.
  -- `date` (sem fuso) para o mês do lançamento não escorregar na virada.
  occurred_on date not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Série mensal e DRE sempre filtram organização e ordenam por competência.
create index finance_entries_org_occurred_idx
  on public.finance_entries (organization_id, occurred_on desc);

create index finance_entries_org_kind_occurred_idx
  on public.finance_entries (organization_id, kind, occurred_on);

create or replace function public.finance_entries_touch_updated_at()
returns trigger
language plpgsql
-- search_path travado: a função roda em trigger de tabela com RLS.
set search_path = ''
as $
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger finance_entries_set_updated_at
  before update on public.finance_entries
  for each row
  execute function public.finance_entries_touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: financeiro é exclusivo do admin da própria organização. Professor e
-- aluno não têm política alguma aqui — sem policy, sem linha.
-- ---------------------------------------------------------------------------
alter table public.finance_entries enable row level security;

create policy finance_entries_admin_select
  on public.finance_entries
  for select
  using (public.is_admin() and organization_id = public.auth_org());

create policy finance_entries_admin_insert
  on public.finance_entries
  for insert
  with check (public.is_admin() and organization_id = public.auth_org());

create policy finance_entries_admin_update
  on public.finance_entries
  for update
  using (public.is_admin() and organization_id = public.auth_org())
  with check (public.is_admin() and organization_id = public.auth_org());

create policy finance_entries_admin_delete
  on public.finance_entries
  for delete
  using (public.is_admin() and organization_id = public.auth_org());
