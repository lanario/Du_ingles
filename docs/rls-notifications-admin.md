# RLS de `notifications`: remover o acesso irrestrito do admin

Projeto Supabase: **Du Ingles** (`qxkqndnvacwoqnvofsth`, sa-east-1).
Tipo de mudança: **alteração de RLS em produção** (1 `DROP POLICY`). Não altera código da aplicação.

---

## 1. O problema

A tabela `public.notifications` tem 3 policies hoje (consultadas em `pg_policies` em 2026-09-18):

| Policy | Comando | Condição (USING / WITH CHECK) |
|---|---|---|
| `notifications_all_admin` | **ALL** | `is_admin()` / `is_admin()` |
| `notifications_select_own` | SELECT | `recipient_id = (select auth.uid())` |
| `notifications_update_own` | UPDATE | `recipient_id = (select auth.uid())` (nos dois) |

A primeira é o problema: `is_admin()` só olha o claim `app_role` do JWT. **Não filtra por `recipient_id` nem por `organization_id`.** Na prática, qualquer pessoa com papel admin, usando a chave pública do Supabase com o próprio JWT (API REST ou Realtime, sem passar pelo app), consegue:

- **ler** as notificações de qualquer usuário, inclusive de **outras organizações**, se houver mais de uma no banco;
- **alterar** e **apagar** notificações de qualquer usuário;
- **inserir** notificações falsas em nome do sistema, para qualquer destinatário.

As notificações têm dados pessoais (ex.: "Fulano saiu da turma", "nota lançada", nomes de alunos).

Hoje isso só não vaza porque o código filtra por `recipient_id` manualmente em [`src/repositories/notifications.ts`](../src/repositories/notifications.ts) (o comentário do arquivo admite que essa é a defesa real). Qualquer caminho novo de leitura que esquecer o filtro expõe a caixa de todo mundo a um admin.

## 2. Por que dá para simplesmente remover a policy

Mapeei **todos** os acessos à tabela no código (`grep` por `from("notifications")`):

| Arquivo | Operação | Client | Depende da policy de admin? |
|---|---|---|---|
| `src/lib/notifications/dispatch.ts:70` | SELECT (deduplicação) | **service-role** | Não, service-role ignora RLS |
| `src/lib/notifications/dispatch.ts:119` | INSERT | **service-role** | Não, idem |
| `src/repositories/notifications.ts:27` | SELECT, `.eq("recipient_id", userId)` | usuário logado | Não, coberto por `notifications_select_own` |
| `src/repositories/notifications.ts:49` | SELECT count, `.eq("recipient_id", userId)` | usuário logado | Não, idem |
| `src/actions/shared/notifications.ts:33, 54, 72` | UPDATE `read_at`, `.eq("recipient_id", ctx.userId)` | usuário logado | Não, coberto por `notifications_update_own` |
| `src/components/features/notification-bell.tsx:237-272` | Realtime INSERT/UPDATE, `filter: recipient_id=eq.<userId>` | browser (JWT do usuário) | Não, Realtime respeita `select_own`; o filtro já é pelo próprio usuário |

Conclusão: **nenhum caminho do app precisa que o admin leia ou escreva notificações de terceiros pelo client autenticado.** Um admin logado enxerga o próprio sino pelas policies `*_own`, como qualquer outro papel.

Depois do `DROP`, ninguém no papel `authenticated` consegue INSERT nem DELETE em `notifications` (não há policy para isso), o que é o desejado: só o service-role escreve.

## 3. O que fazer (passo a passo)

### 3.1 Antes: confirmar o estado atual (somente leitura)

```sql
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'notifications'
order by policyname;
```

Esperado: as 3 policies da tabela acima.

### 3.2 Aplicar a migration

Arquivo sugerido: `supabase/migrations/20260918_notifications_drop_admin_all.sql`
(nome no banco: `notifications_drop_admin_all`).

```sql
-- ---------------------------------------------------------------------------
-- Notificações: admin deixa de ter acesso irrestrito.
--
-- `notifications_all_admin` (ALL, `is_admin()`) não filtrava por destinatário
-- nem por organização: um admin com o JWT dele na API REST/Realtime lia,
-- alterava e apagava a caixa de qualquer usuário. Nada no app depende dela:
--   • toda escrita (`lib/notifications/dispatch.ts`) usa service-role, que
--     ignora RLS;
--   • toda leitura/atualização de tela já filtra por `recipient_id` e é
--     coberta por `notifications_select_own` / `notifications_update_own`;
--   • o Realtime do sino filtra por `recipient_id=eq.<próprio usuário>`.
-- ---------------------------------------------------------------------------

drop policy if exists notifications_all_admin on public.notifications;
```

Pode ser aplicada pelo painel do Supabase (SQL Editor), pela CLI (`supabase db push`) ou pelo MCP (`apply_migration`).

### 3.3 Depois: confirmar

```sql
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'notifications'
order by policyname;
```

Esperado: **só** `notifications_select_own` e `notifications_update_own`.

## 4. Como testar

### 4.1 Teste de RLS direto no banco (não altera dados)

Simula um admin usando o JWT dele. Troque `<ADMIN_UUID>` e `<ORG_UUID>` por valores reais (`select id, organization_id from profiles where role = 'admin' limit 1;`).

```sql
begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"<ADMIN_UUID>","app_role":"admin","org_id":"<ORG_UUID>"}',
  true
);

-- Antes do DROP: retorna notificações de TODOS. Depois do DROP: só as do admin.
select count(*) as visiveis, count(distinct recipient_id) as destinatarios
from public.notifications;

-- Depois do DROP: deve dar erro de RLS (não há policy de INSERT).
-- insert into public.notifications (organization_id, recipient_id, type, title)
-- values ('<ORG_UUID>', '<ADMIN_UUID>', 'teste', 'teste');
rollback;
```

Esperado depois do DROP: `destinatarios` ≤ 1 (só o próprio admin) e o INSERT comentado falha com `new row violates row-level security policy`.

### 4.2 Teste funcional no app (depois de aplicar)

1. Logar como **admin**: o sino abre, lista as próprias notificações, "marcar como lida" e "marcar todas como lidas" funcionam.
2. Como admin, disparar um evento que notifique (ex.: matricular um aluno em `/admin/alunos`) e conferir que o **aluno** e o **professor** recebem a notificação (a escrita é service-role, não deve mudar).
3. Logar como **aluno** e **professor**: sino, lida/não lida e recebimento em tempo real continuam funcionando (Realtime).

## 5. Riscos e rollback

- **Risco baixo:** pelo mapeamento acima, nenhum fluxo usa a policy. O `grep` cobriu `src/` inteiro. Conferi também as funções do banco (`select proname from pg_proc where pronamespace = 'public'::regnamespace and prokind = 'f' and pg_get_functiondef(oid) ilike '%notifications%'`): **nenhuma função referencia `notifications`**. O único jeito de algo quebrar é um caminho de leitura fora do repositório (por exemplo, uma consulta manual de suporte feita pelo painel com JWT de admin).

- **Rollback** (recria a policy exatamente como estava):

  ```sql
  create policy notifications_all_admin
  on public.notifications
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
  ```

## 6. Alternativa (só se precisarem de auditoria pelo admin)

Se algum dia a coordenação precisar **ler** notificações de outros usuários (ex.: suporte), em vez de manter o `ALL`, criar uma policy **só de SELECT e restrita à organização**:

```sql
create policy notifications_select_admin_org
on public.notifications
for select
to authenticated
using (organization_id = public.auth_org() and public.is_admin());
```

Não recomendo criar agora: nada usa isso, e o padrão do projeto é o admin acessar dados de terceiros pelo service-role em Server Actions, com checagem no código.

## 7. Observação: `is_admin()` não olha organização

`is_admin()` (`select auth_role() = 'admin'`) só confere o papel, não a organização. Algumas policies de admin (ex.: `profiles_all_admin`, `submissions_all_admin`) somam `organization_id = auth_org()`, mas outras não. Consulta feita em 2026-09-18:

```sql
select tablename, policyname, cmd, qual
from pg_policies
where schemaname = 'public'
  and qual ilike '%is_admin()%'
  and qual not ilike '%auth_org()%';
```

Resultado: policies de admin **sem filtro de organização** em:

| Tabela | Policy |
|---|---|
| `notifications` | `notifications_all_admin` (tema deste documento) |
| `messages` | `messages_all_admin` (**mensagens do chat**) |
| `conversation_participants` | `cp_all_admin` |
| `session_content_versions` | `scv_all_admin` |
| `assignment_templates` | `assignment_templates_select` / `_update` / `_delete` (podem ter outra regra de organização, revisar) |

Isso só tem efeito real se existir **mais de uma organização** no banco (confirme com `select count(*) from organizations;`). Com uma organização só, o risco cruzado entre escolas não existe, mas o admin continua com acesso irrestrito a essas tabelas. `messages` é a mais sensível dessa lista, por conter conversas. Fica como item separado: não faz parte da mudança deste documento.
