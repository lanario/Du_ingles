-- Complemento da 0044: as três `*_public` de `lesson_plan_folders`.
--
-- ATENÇÃO: esta migration ainda NÃO foi aplicada em produção.
--
-- Elas ficaram de fora do relatório do linter porque não citam `auth.*` no
-- texto — só `is_admin()` e `auth_org()`. Mas o Postgres avalia TODAS as
-- policies permissivas de um comando, e estas três dividem tabela e comando
-- com as quatro `*_own` que a 0044 corrigiu: sem elas, um DELETE em
-- `lesson_plan_folders` continua reexecutando `is_admin()` linha a linha por
-- causa de `delete_public`, e a 0044 não chega a valer para esta tabela.
--
-- Como na 0044: mesma expressão, mesmos operadores, mesma ordem — a única
-- diferença é o `select` em volta de cada chamada. Nada de autorização muda.

drop policy if exists lesson_plan_folders_insert_public on public.lesson_plan_folders;
create policy lesson_plan_folders_insert_public
  on public.lesson_plan_folders
  for insert
  with check (
    is_public
    and (select public.is_admin())
    and organization_id = (select public.auth_org())
  );

drop policy if exists lesson_plan_folders_update_public on public.lesson_plan_folders;
create policy lesson_plan_folders_update_public
  on public.lesson_plan_folders
  for update
  using (
    is_public
    and (select public.is_admin())
    and organization_id = (select public.auth_org())
  )
  with check (
    is_public
    and (select public.is_admin())
    and organization_id = (select public.auth_org())
  );

drop policy if exists lesson_plan_folders_delete_public on public.lesson_plan_folders;
create policy lesson_plan_folders_delete_public
  on public.lesson_plan_folders
  for delete
  using (
    is_public
    and (select public.is_admin())
    and organization_id = (select public.auth_org())
  );
