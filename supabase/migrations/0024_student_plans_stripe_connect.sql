-- ---------------------------------------------------------------------------
-- Planos de alunos + Stripe Connect.
--
-- Três tabelas, três responsabilidades distintas:
--
--   `stripe_connect_accounts`  — a conta conectada (Express) da escola. Uma
--     por organização. O dinheiro das assinaturas passa pela conta plataforma
--     (Du Inglês) e é repassado para esta conta; por isso o que guardamos aqui
--     são os *gates* do Connect (`charges_enabled`, `payouts_enabled`), não
--     dados bancários — esses nunca tocam o nosso banco.
--
--   `student_plans`            — o catálogo comercial. É a fonte da verdade do
--     que o admin desenhou; os `stripe_*_id` são o espelho daquilo na Stripe.
--     Guardar preço em centavos aqui (e não só na Stripe) mantém a vitrine
--     renderizável sem round-trip à API a cada pageview.
--
--   `student_subscriptions`    — o contrato vivo entre aluno e plano. Escrito
--     quase sempre pelo webhook, nunca pelo browser: por isso não há policy
--     de insert/update para `authenticated`.
--
-- Aplicada em 19/08/2026 no projeto 'Du Ingles' (qxkqndnvacwoqnvofsth).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- Periodicidade comercial. Trimestral/semestral não existem na Stripe como
-- `interval` próprio — viram `month` com `interval_count` 3 e 6. O enum aqui
-- é o vocabulário do admin; a tradução para a Stripe fica no código.
create type public.plan_interval as enum (
  'month',
  'quarter',
  'semester',
  'year',
  'one_time'
);

-- Estado do espelhamento do plano na Stripe. `draft` é o plano que existe só
-- no nosso banco (rascunho ou Stripe ainda não configurada); `error` guarda a
-- última falha para o admin ver e reprocessar sem abrir log.
create type public.plan_sync_status as enum ('draft', 'synced', 'error');

-- Espelha `subscription.status` da Stripe, sem inventar valores próprios:
-- qualquer divergência viraria bug silencioso no webhook.
create type public.subscription_status as enum (
  'incomplete',
  'incomplete_expired',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'paused'
);

-- Modelo de cobrança do Connect. `destination`: a cobrança nasce na conta
-- plataforma e o valor é transferido para a conta conectada (é o que dá ao
-- dono da plataforma a visão e a gestão de *todo* o fluxo). `direct`: a
-- cobrança nasce na própria conta conectada. A coluna existe para a escolha
-- ser por organização, não uma constante enterrada no código.
create type public.stripe_charge_model as enum ('destination', 'direct');

-- ---------------------------------------------------------------------------
-- Conta conectada da organização
-- ---------------------------------------------------------------------------
create table public.stripe_connect_accounts (
  id uuid primary key default gen_random_uuid(),
  -- Uma conta conectada por organização: o `unique` é o que impede o
  -- onboarding de ser disparado duas vezes e criar contas órfãs na Stripe.
  organization_id uuid not null unique
    references public.organizations (id) on delete cascade,
  stripe_account_id text not null unique,
  charge_model public.stripe_charge_model not null default 'destination',
  -- Comissão da plataforma sobre cada fatura, em pontos percentuais.
  -- 0 = a escola recebe integralmente e a plataforma só intermedia.
  application_fee_percent numeric(5, 2) not null default 0
    check (application_fee_percent >= 0 and application_fee_percent <= 100),
  country text not null default 'BR',
  default_currency text not null default 'brl',
  -- Os dois gates do Connect. Enquanto `charges_enabled` for falso a Stripe
  -- recusa qualquer cobrança destinada a esta conta — a UI precisa saber
  -- disso *antes* de deixar o admin publicar um plano.
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  -- Pendências do onboarding, como a Stripe as devolve. Renderizadas cruas
  -- para o admin: traduzir cada código aqui seria um dicionário eternamente
  -- desatualizado.
  requirements jsonb not null default '{}'::jsonb,
  business_name text,
  -- `false` enquanto a integração roda com chave de teste. Guardar isto evita
  -- o pior erro possível: um plano de sandbox virar link de cobrança real.
  livemode boolean not null default false,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger stripe_connect_accounts_set_updated_at
  before update on public.stripe_connect_accounts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Catálogo de planos
-- ---------------------------------------------------------------------------
create table public.student_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,

  name text not null check (char_length(trim(name)) between 2 and 120),
  -- Chamada curta do cartão ("Para quem estuda sozinho"). Não é a descrição.
  headline text check (headline is null or char_length(headline) <= 160),
  description text check (description is null or char_length(description) <= 2000),
  -- Lista de benefícios do cartão. `jsonb` de strings: a ordem importa e o
  -- número varia por plano, então uma tabela filha só traria join sem ganho.
  features jsonb not null default '[]'::jsonb,

  -- Mesmo padrão do financeiro: centavos em bigint, exato e somável.
  price_cents bigint not null check (price_cents >= 0),
  currency text not null default 'brl',
  billing_interval public.plan_interval not null default 'month',
  -- Matrícula/adesão cobrada uma única vez junto da primeira fatura.
  setup_fee_cents bigint not null default 0 check (setup_fee_cents >= 0),
  trial_days integer not null default 0 check (trial_days between 0 and 365),

  -- Conteúdo do pacote — o que o aluno compra, não o que ele paga.
  lessons_per_month integer check (lessons_per_month is null or lessons_per_month > 0),
  minutes_per_lesson integer check (minutes_per_lesson is null or minutes_per_lesson > 0),
  level public.cefr_level,
  -- Teto de assinantes simultâneos. `null` = ilimitado.
  seat_limit integer check (seat_limit is null or seat_limit > 0),

  -- Apresentação na vitrine.
  accent text not null default 'gold' check (accent in ('gold', 'navy', 'emerald', 'violet')),
  badge text check (badge is null or char_length(badge) <= 24),
  is_featured boolean not null default false,
  -- `is_public` controla a vitrine do aluno; `is_active` controla a venda.
  -- Separados de propósito: um plano legado precisa parar de ser vendido sem
  -- sumir de quem já assina.
  is_public boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0,

  -- Espelho na Stripe.
  stripe_product_id text,
  stripe_price_id text,
  stripe_payment_link_id text,
  stripe_payment_link_url text,
  sync_status public.plan_sync_status not null default 'draft',
  sync_error text,
  synced_at timestamptz,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A vitrine do aluno e a lista do admin filtram por organização e ordenam
-- pela posição escolhida no painel.
create index student_plans_org_sort_idx
  on public.student_plans (organization_id, sort_order, created_at desc);

-- O webhook chega com o preço da Stripe e precisa achar o plano por ele.
create unique index student_plans_stripe_price_idx
  on public.student_plans (stripe_price_id)
  where stripe_price_id is not null;

create trigger student_plans_set_updated_at
  before update on public.student_plans
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Assinaturas dos alunos
-- ---------------------------------------------------------------------------
create table public.student_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  -- `set null`: apagar um plano do catálogo não pode apagar o histórico de
  -- quem pagou por ele.
  plan_id uuid references public.student_plans (id) on delete set null,

  stripe_customer_id text not null,
  stripe_subscription_id text unique,
  stripe_checkout_session_id text,

  status public.subscription_status not null default 'incomplete',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  trial_end timestamptz,

  -- Valor congelado no momento da assinatura: se o admin reajustar o plano,
  -- quem já assina continua exibindo o que de fato paga.
  amount_cents bigint,
  currency text not null default 'brl',
  hosted_invoice_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index student_subscriptions_org_status_idx
  on public.student_subscriptions (organization_id, status);

create index student_subscriptions_student_idx
  on public.student_subscriptions (student_id, created_at desc);

-- O checkout procura o customer existente do aluno antes de criar outro:
-- sem isto, cada assinatura nova geraria um Customer duplicado na Stripe.
create index student_subscriptions_customer_idx
  on public.student_subscriptions (stripe_customer_id);

create trigger student_subscriptions_set_updated_at
  before update on public.student_subscriptions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.stripe_connect_accounts enable row level security;

-- Credenciais de recebimento são assunto exclusivo do admin da organização.
-- Professor e aluno não têm policy alguma aqui — sem policy, sem linha.
create policy stripe_connect_accounts_admin_all
  on public.stripe_connect_accounts
  for all
  using (public.is_admin() and organization_id = public.auth_org())
  with check (public.is_admin() and organization_id = public.auth_org());

alter table public.student_plans enable row level security;

create policy student_plans_admin_all
  on public.student_plans
  for all
  using (public.is_admin() and organization_id = public.auth_org())
  with check (public.is_admin() and organization_id = public.auth_org());

-- Vitrine: qualquer pessoa autenticada da organização enxerga o que está
-- publicado e à venda. Rascunho e plano arquivado ficam invisíveis.
create policy student_plans_member_read_public
  on public.student_plans
  for select
  using (
    organization_id = public.auth_org()
    and is_public
    and is_active
  );

alter table public.student_subscriptions enable row level security;

create policy student_subscriptions_admin_read
  on public.student_subscriptions
  for select
  using (public.is_admin() and organization_id = public.auth_org());

-- O aluno vê a própria assinatura e nada mais. Escrita não tem policy: quem
-- muda status é o webhook, via service-role, com a assinatura do evento
-- verificada — um cliente comprometido não consegue se declarar `active`.
create policy student_subscriptions_own_read
  on public.student_subscriptions
  for select
  using (student_id = (select auth.uid()));
