-- ---------------------------------------------------------------------------
-- Pasta pública do ateliê
--
-- Até aqui toda pasta era estante pessoal (0035): ninguém via a do outro. Mas
-- professor cria aula e quer deixá-la como referência para a escola inteira
-- usar de parâmetro — faltava um lugar que não fosse de ninguém e fosse de
-- todos ao mesmo tempo.
--
-- `is_public` é essa exceção, e só essa: a pasta continua sendo pasta (entra
-- na mesma lista, aceita arrastar aula, conta junto no ateliê) — o que muda é
-- quem enxerga (a escola inteira, não só o dono) e quem mexe na pasta em si
-- (só admin renomeia ou apaga; arquivar/tirar uma aula de dentro continua
-- sendo de quem pode escrever aquela aula, igual numa pasta pessoal).
-- ---------------------------------------------------------------------------

alter table public.lesson_plan_folders
  add column if not exists is_public boolean not null default false;

-- O índice de nome único era só por dono. Pasta pública não tem "dono" para
-- esse fim — o par que precisa ser único ali é (escola, nome).
drop index if exists lesson_plan_folders_owner_name_idx;

create unique index if not exists lesson_plan_folders_owner_name_idx
  on public.lesson_plan_folders (owner_id, lower(btrim(name)))
  where not is_public;

create unique index if not exists lesson_plan_folders_org_public_name_idx
  on public.lesson_plan_folders (organization_id, lower(btrim(name)))
  where is_public;

-- ---------------------------------------------------------------------------
-- RLS. A leitura ganha a exceção: pública é visível para a escola inteira.
-- A escrita da pasta em si (renomear/criar/apagar) fica dividida em dois
-- pares de policy — pessoal (dono, nunca pública) e pública (só admin) — o
-- "rede de baixo" continua sendo o service-role + a action; isto aqui é só
-- o que sobra para um client com a chave anônima.
-- ---------------------------------------------------------------------------

drop policy if exists lesson_plan_folders_select_own on public.lesson_plan_folders;
create policy lesson_plan_folders_select_own
  on public.lesson_plan_folders
  for select
  using (
    owner_id = auth.uid()
    or (is_public and organization_id = public.auth_org())
  );

drop policy if exists lesson_plan_folders_insert_own on public.lesson_plan_folders;
create policy lesson_plan_folders_insert_own
  on public.lesson_plan_folders
  for insert
  with check (
    not is_public
    and owner_id = auth.uid()
    and organization_id = public.auth_org()
  );

drop policy if exists lesson_plan_folders_insert_public on public.lesson_plan_folders;
create policy lesson_plan_folders_insert_public
  on public.lesson_plan_folders
  for insert
  with check (
    is_public
    and public.is_admin()
    and organization_id = public.auth_org()
  );

drop policy if exists lesson_plan_folders_update_own on public.lesson_plan_folders;
create policy lesson_plan_folders_update_own
  on public.lesson_plan_folders
  for update
  using (owner_id = auth.uid() and not is_public)
  with check (
    owner_id = auth.uid()
    and not is_public
    and organization_id = public.auth_org()
  );

drop policy if exists lesson_plan_folders_update_public on public.lesson_plan_folders;
create policy lesson_plan_folders_update_public
  on public.lesson_plan_folders
  for update
  using (is_public and public.is_admin() and organization_id = public.auth_org())
  with check (is_public and public.is_admin() and organization_id = public.auth_org());

drop policy if exists lesson_plan_folders_delete_own on public.lesson_plan_folders;
create policy lesson_plan_folders_delete_own
  on public.lesson_plan_folders
  for delete
  using (owner_id = auth.uid() and not is_public);

drop policy if exists lesson_plan_folders_delete_public on public.lesson_plan_folders;
create policy lesson_plan_folders_delete_public
  on public.lesson_plan_folders
  for delete
  using (is_public and public.is_admin() and organization_id = public.auth_org());
