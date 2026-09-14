-- O sistema inteiro em tempo real.
--
-- Até aqui só duas tabelas estavam na publicação: `notifications` (0035) e
-- `conversations` (0026). Tudo o mais — aula marcada, horário movido, chamada
-- feita, tarefa enviada, correção fechada, matrícula, plano, lançamento —
-- só aparecia no próximo carregamento da página. Com duas pessoas mexendo ao
-- mesmo tempo (secretaria e professor, professor e aluno) isso vira tela
-- desatualizada e trabalho refeito.
--
-- O cliente assina essas tabelas por `<LiveRefresh>` (components/features/
-- live-refresh.tsx) e usa o evento SÓ como gatilho de `router.refresh()`.
-- Nada do payload é desenhado na tela: quem monta o que cada usuário vê
-- continua sendo o servidor.
--
-- ---------------------------------------------------------------------------
-- A trava de segurança
-- ---------------------------------------------------------------------------
-- `postgres_changes` entrega a linha inteira ao assinante e filtra por RLS.
-- Tabela publicada SEM RLS é vazamento: qualquer usuário autenticado receberia
-- toda escrita dela. Por isso o laço abaixo só publica o que tem
-- `relrowsecurity` ligada e avisa (sem falhar) sobre o que ficou de fora —
-- tabela esquecida vira "não atualiza sozinha", nunca "vaza".
--
-- Coluna sensível já está coberta de graça: o Realtime respeita GRANT de
-- coluna, então `assignments.answer_key` e `assignment_submissions.auto_score`
-- (0030), fora do SELECT de `authenticated`, também ficam fora do payload.
--
-- Idempotente: rodar de novo não faz nada.

do $$
declare
  target text;
  published boolean;
  protected boolean;
  skipped text[] := '{}';
begin
  foreach target in array array[
    -- aulas e o que acontece dentro delas
    'class_sessions',
    'attendance',
    -- calendário
    'agenda_events',
    -- tarefas
    'assignments',
    'assignment_submissions',
    'assignment_templates',
    -- turmas e matrículas
    'groups',
    'enrollments',
    -- planejador
    'lesson_plans',
    'lesson_plan_folders',
    -- cadastro
    'profiles',
    'user_invites',
    -- planos e dinheiro
    'student_plans',
    'student_subscriptions',
    'finance_entries',
    -- chat (o corpo da conversa; `conversations` entrou na 0026)
    'messages'
  ]
  loop
    select c.relrowsecurity into protected
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = target;

    if protected is null then
      continue; -- tabela ainda não existe neste banco
    end if;

    if not protected then
      skipped := skipped || target;
      continue;
    end if;

    select exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = target
    ) into published;

    if not published then
      execute format('alter publication supabase_realtime add table public.%I', target);
    end if;
  end loop;

  if array_length(skipped, 1) is not null then
    raise warning 'tempo real: % ficou de fora por estar sem RLS', array_to_string(skipped, ', ');
  end if;
end;
$$;
