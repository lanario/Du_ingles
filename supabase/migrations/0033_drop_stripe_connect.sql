-- ---------------------------------------------------------------------------
-- Remove o Stripe Connect: a plataforma passa a cobrar pela conta Stripe
-- própria (padrão), sem contas conectadas por organização.
--
-- `stripe_connect_accounts` nunca teve uma linha em produção (nenhuma escola
-- concluiu o onboarding Express) — dropar a tabela não perde histórico de
-- pagamento nenhum. `student_plans` e `student_subscriptions` não referenciam
-- esta tabela, então não há FK a desfazer.
--
-- Aplicada em 05/09/2026 no projeto 'Du Ingles' (qxkqndnvacwoqnvofsth).
-- ---------------------------------------------------------------------------

drop table public.stripe_connect_accounts;
drop type public.stripe_charge_model;
