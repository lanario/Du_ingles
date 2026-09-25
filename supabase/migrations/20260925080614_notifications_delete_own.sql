-- Permite que cada usuário apague somente as notificações da própria caixa.
-- A aplicação também filtra explicitamente por recipient_id; a policy mantém
-- a mesma garantia caso a Data API seja chamada fora desse fluxo.

grant delete on table public.notifications to authenticated;

drop policy if exists notifications_delete_own on public.notifications;

create policy notifications_delete_own
  on public.notifications
  for delete
  to authenticated
  using ((select auth.uid()) = recipient_id);
