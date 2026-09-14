-- `auth.uid()` das últimas duas tabelas passa a ser InitPlan.
--
-- O linter de performance do Supabase (`auth_rls_initplan`) aponta oito
-- policies — as quatro de `assignment_templates` (0038) e as quatro de
-- `lesson_plan_folders` (0035/0037) — em que `auth.uid()` aparece solto na
-- expressão. Solto, o planner trata a chamada como algo que pode mudar de
-- linha para linha e a reexecuta uma vez POR LINHA examinada; dentro de um
-- `(select ...)` ela vira um InitPlan, calculado uma vez para a consulta
-- inteira. O resultado é idêntico — `auth.uid()` lê a claim do JWT do request,
-- que não muda no meio da consulta —, então isto é só o planner parando de
-- fazer trabalho repetido.
--
-- `public.is_admin()` e `public.auth_org()` entram no mesmo embrulho pelo mesmo
-- motivo: são `stable` e leem `request.jwt.claims` via `current_setting`, e o
-- linter não as aponta apenas porque procura o nome `auth.*` no texto da
-- policy. Quem paga a conta é a mesma consulta.
--
-- Escopo: nada de autorização muda aqui. Cada policy abaixo é recriada com a
-- MESMA expressão, com os mesmos operadores e na mesma ordem — a única
-- diferença é o `select` em volta de cada chamada.

-- ---------------------------------------------------------------------------
-- assignment_templates (0038)
-- ---------------------------------------------------------------------------

drop policy if exists assignment_templates_select on public.assignment_templates;
create policy assignment_templates_select
  on public.assignment_templates
  for select
  using (owner_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists assignment_templates_insert on public.assignment_templates;
create policy assignment_templates_insert
  on public.assignment_templates
  for insert
  with check (
    owner_id = (select auth.uid())
    and organization_id = (select public.auth_org())
  );

drop policy if exists assignment_templates_update on public.assignment_templates;
create policy assignment_templates_update
  on public.assignment_templates
  for update
  using (owner_id = (select auth.uid()) or (select public.is_admin()))
  with check (organization_id = (select public.auth_org()));

drop policy if exists assignment_templates_delete on public.assignment_templates;
create policy assignment_templates_delete
  on public.assignment_templates
  for delete
  using (owner_id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- lesson_plan_folders (0035 + 0037)
-- ---------------------------------------------------------------------------

drop policy if exists lesson_plan_folders_select_own on public.lesson_plan_folders;
create policy lesson_plan_folders_select_own
  on public.lesson_plan_folders
  for select
  using (
    owner_id = (select auth.uid())
    or (is_public and organization_id = (select public.auth_org()))
  );

drop policy if exists lesson_plan_folders_insert_own on public.lesson_plan_folders;
create policy lesson_plan_folders_insert_own
  on public.lesson_plan_folders
  for insert
  with check (
    not is_public
    and owner_id = (select auth.uid())
    and organization_id = (select public.auth_org())
  );

drop policy if exists lesson_plan_folders_update_own on public.lesson_plan_folders;
create policy lesson_plan_folders_update_own
  on public.lesson_plan_folders
  for update
  using (owner_id = (select auth.uid()) and not is_public)
  with check (
    owner_id = (select auth.uid())
    and not is_public
    and organization_id = (select public.auth_org())
  );

drop policy if exists lesson_plan_folders_delete_own on public.lesson_plan_folders;
create policy lesson_plan_folders_delete_own
  on public.lesson_plan_folders
  for delete
  using (owner_id = (select auth.uid()) and not is_public);

-- ---------------------------------------------------------------------------
-- Sobre os 27 "unindexed foreign keys" do mesmo relatório: nenhum entra aqui.
-- ---------------------------------------------------------------------------
--
-- Quase todos são coluna de autoria (`created_by`, `recorded_by`,
-- `graded_by`) ou de organização, que consulta nenhuma filtra — indexá-las só
-- encareceria a escrita. As duas que pareciam valer não valem:
--
--   - `groups.teacher_id` já é coberta por `groups_org_teacher_idx`;
--   - `lesson_plans.author_id` já é coberta por `lesson_plans_org_author_idx`,
--     e `listLessonPlans` nem filtra por autor — ela lê tudo que a RLS deixa
--     passar e decide `isOwn` em memória.
--
-- O mesmo relatório ainda acusa 12 índices que nunca foram usados. Criar mais
-- antes que exista consulta pedindo seria aumentar essa lista.
