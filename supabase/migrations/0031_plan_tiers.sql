-- ---------------------------------------------------------------------------
-- Nível e ritmo do plano.
--
-- O catálogo (`student_plans`, 0024) era uma lista plana: cada linha, um
-- plano solto. A vitrine comercial da escola segue uma estrutura fixa —
-- Standard/Premium/Elite × 1x/2x/3x por semana × Mensal/Semestral/Anual —
-- e o aluno escolhe em três passos, não numa grade de cartões soltos.
--
-- `tier` e `weekly_frequency` são os dois eixos que faltavam para a vitrine
-- filtrar o catálogo por esses passos. `billing_interval` (0024) já cobre o
-- terceiro eixo (compromisso). Ambos ficam nulos por padrão: um plano
-- avulso, fora da grade de níveis, continua válido — é o que sustenta um
-- link de pagamento sob medida que o admin queira montar fora do padrão.
-- ---------------------------------------------------------------------------

create type public.plan_tier as enum ('standard', 'premium', 'elite');

alter table public.student_plans
  add column tier public.plan_tier,
  add column weekly_frequency smallint
    check (weekly_frequency is null or weekly_frequency in (1, 2, 3));

-- A vitrine busca "o Premium, 2x por semana, semestral" com uma igualdade
-- direta nos três eixos — o índice parcial (só planos com tier definido)
-- é o que torna essa busca uma leitura de índice, não uma varredura.
create index student_plans_org_tier_idx
  on public.student_plans (organization_id, tier, weekly_frequency, billing_interval)
  where tier is not null;
