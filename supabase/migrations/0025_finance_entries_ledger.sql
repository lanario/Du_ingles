-- ---------------------------------------------------------------------------
-- Contas a receber / a pagar sobre `finance_entries`.
--
-- A tabela nasceu (0023) só para alimentar o gráfico de receita e o DRE do
-- painel: um lançamento era um *fato consumado*. A tela de Financeiro precisa
-- do passo anterior — o que foi combinado, quando vence, se já entrou e por
-- qual meio — sem duplicar a origem do dinheiro em outra tabela.
--
-- As colunas novas não mexem em `kind` nem em `occurred_on`: a competência
-- continua fechando o mês do DRE, e `due_on` responde por vencimento. Um
-- lançamento de agosto pago em setembro continua sendo receita de agosto.
--
-- "Vencido" não é estado gravado: é `status = 'pending' and due_on < today`.
-- Guardar isso numa coluna exigiria um job diário para envelhecer as linhas —
-- e um lançamento ficaria mentindo até o job rodar.
--
-- Aplicada em 19/08/2026 no projeto 'Du Ingles' (qxkqndnvacwoqnvofsth).
-- ---------------------------------------------------------------------------

create type public.finance_entry_status as enum ('pending', 'paid');

create type public.finance_payment_method as enum (
  'pix',
  'boleto',
  'credit_card',
  'debit_card',
  'cash',
  'transfer',
  'other'
);

alter table public.finance_entries
  -- 'paid' = dinheiro já entrou (ou saiu) na conta da escola.
  add column status public.finance_entry_status not null default 'pending',
  -- Vencimento. Preenchido por trigger com `occurred_on` quando omitido.
  add column due_on date,
  -- Data da baixa. Só faz sentido com `status = 'paid'` — o check abaixo
  -- impede a combinação incoerente de sobreviver a um update parcial.
  add column paid_on date,
  add column payment_method public.finance_payment_method,
  -- Linha de negócio: 'mensalidade', 'material', 'aluguel', ... O vocabulário
  -- vive em `src/schemas/finance.ts` porque é a UI que decide quais categorias
  -- oferecer por tipo; um enum no banco obrigaria migração a cada ajuste de
  -- nomenclatura comercial.
  add column category text not null default 'outros',
  -- Quem paga ou recebe: aluno, professor, fornecedor. Texto livre porque a
  -- contraparte nem sempre é alguém cadastrado na plataforma.
  add column counterparty text,
  add column notes text;

-- Linhas anteriores a esta migração eram fatos consumados: entram como pagas
-- e vencendo na própria competência.
update public.finance_entries
set
  due_on = occurred_on,
  status = 'paid',
  paid_on = occurred_on
where due_on is null;

alter table public.finance_entries
  alter column due_on set not null;

alter table public.finance_entries
  add constraint finance_entries_paid_on_matches_status
  check (
    (status = 'paid' and paid_on is not null)
    or (status = 'pending' and paid_on is null)
  );

-- A lista da tela é sempre "mês X, em aberto ou não" — o índice cobre a
-- ordenação por vencimento dentro da organização.
create index finance_entries_org_due_idx
  on public.finance_entries (organization_id, due_on desc);

create index finance_entries_org_status_due_idx
  on public.finance_entries (organization_id, status, due_on);

/*
 * `due_on` é obrigatório no banco mas opcional na UI: quem lança uma despesa
 * já paga não deveria ter de repetir a data em dois campos. O default cai
 * sobre a competência.
 */
create or replace function public.finance_entries_fill_due_on()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.due_on is null then
    new.due_on := new.occurred_on;
  end if;
  return new;
end;
$$;

create trigger finance_entries_set_due_on
  before insert on public.finance_entries
  for each row
  execute function public.finance_entries_fill_due_on();
