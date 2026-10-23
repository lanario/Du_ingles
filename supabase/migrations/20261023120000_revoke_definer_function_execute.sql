-- Funções SECURITY DEFINER do schema public ficam executáveis por PUBLIC por
-- padrão, então `anon` chamava `/rest/v1/rpc/...` e agia sobre qualquer
-- organização. Só o que as policies de RLS (avaliadas como `authenticated`)
-- ou o app (service_role) realmente usam continua com EXECUTE.

-- Só service_role / postgres (pg_cron): geração de sessões e rotinas de trigger.
revoke execute on function public.generate_recurring_sessions(uuid)
  from public, anon, authenticated;
revoke execute on function public.ensure_group_conversation(uuid)
  from public, anon, authenticated;
revoke execute on function public.sync_group_conversation()
  from public, anon, authenticated;
revoke execute on function public.sync_enrollment_conversation()
  from public, anon, authenticated;

-- Usadas dentro de policies de RLS: `authenticated` precisa, `anon` não.
revoke execute on function public.profile_role(uuid) from public, anon;
grant execute on function public.profile_role(uuid) to authenticated;
revoke execute on function public.can_post_in_conversation(uuid) from public, anon;
grant execute on function public.can_post_in_conversation(uuid) to authenticated;

-- RPC chamada pelo app logado.
revoke execute on function public.group_chat_overview() from public, anon;
grant execute on function public.group_chat_overview() to authenticated;
