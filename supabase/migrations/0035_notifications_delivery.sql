-- Entrega das notificações: realtime + índices da caixa.
--
-- O sino (`components/features/notification-bell.tsx`) assina
-- `postgres_changes` em `notifications` filtrando por `recipient_id`. Sem a
-- tabela na publicação, o aviso só aparece no próximo carregamento de página —
-- e o catálogo de eventos (`lib/notifications/events.ts`) passou a escrever aí
-- em praticamente toda ação do sistema.
--
-- Idempotente: se a publicação já tiver a tabela, nada acontece.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

-- ------------------------------------------------------------------ índices --

-- Leitura do painel: as 20 últimas do destinatário, mais recentes primeiro.
create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);

-- Badge de não lidas e a deduplicação do envio (`dispatchNotifications` com
-- `dedupe.unread`, que evita uma linha por mensagem de chat): as duas varrem
-- só o que está sem `read_at`, então o índice parcial é o que basta.
create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_id, type)
  where read_at is null;
