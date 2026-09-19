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
