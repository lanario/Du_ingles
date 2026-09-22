-- Dados do questionário de autocadastro. A ficha completa fica em uma tabela
-- separada para que as policies existentes de leitura de student_profiles não
-- exponham preferências pessoais a professores.
create table public.student_registrations (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  requested_plan_id uuid references public.student_plans (id) on delete set null,
  stripe_customer_id text,
  stripe_checkout_session_id text,
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now()
);

create index student_registrations_org_submitted_idx
  on public.student_registrations (organization_id, submitted_at desc);

create unique index student_registrations_stripe_customer_idx
  on public.student_registrations (stripe_customer_id)
  where stripe_customer_id is not null;

alter table public.student_registrations enable row level security;
revoke all on public.student_registrations from anon, authenticated;

-- A função de anonimização, criada na migration 0052, preserva o histórico
-- pedagógico, mas não deve guardar as respostas pessoais deste questionário.
create or replace function public.clear_student_registration_on_anonymize()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if new.anonymized_at is not null and old.anonymized_at is null then
    update public.student_registrations
       set answers = '{}'::jsonb,
           requested_plan_id = null,
           stripe_customer_id = null,
           stripe_checkout_session_id = null
     where profile_id = new.id;
  end if;
  return new;
end;
$fn$;

drop trigger if exists profiles_clear_student_registration_on_anonymize on public.profiles;
create trigger profiles_clear_student_registration_on_anonymize
  after update of anonymized_at on public.profiles
  for each row
  execute function public.clear_student_registration_on_anonymize();

revoke all on function public.clear_student_registration_on_anonymize() from public, anon, authenticated;
