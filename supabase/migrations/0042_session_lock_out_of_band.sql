-- A trava da sala de aula sai de dentro de `class_sessions`.
--
-- O lock leve contra duas abas (§8.3) batia de 30 em 30 segundos num UPDATE
-- da própria linha da aula, só para renovar `locked_at`. Isso sempre foi caro
-- pelo lado errado: `class_sessions.content` guarda o documento da aula
-- inteiro, então cada batida reescrevia uma linha gorda no WAL sem nada ter
-- mudado de verdade.
--
-- Com a 0041 a conta piorou: `class_sessions` passou a ser a tabela que quase
-- toda tela escuta (agenda, painel, turmas, progresso). Uma sala aberta faria
-- TODO mundo com uma dessas telas revalidar a cada 30 segundos por causa de um
-- campo que ninguém desenha.
--
-- A trava vira uma linha por aula em tabela própria, fora da publicação. O
-- batimento continua igual para quem usa; simplesmente deixa de ser um evento.

create table if not exists public.class_session_locks (
  session_id uuid primary key references public.class_sessions (id) on delete cascade,
  locked_by  text        not null,
  locked_at  timestamptz not null default now()
);

-- Nenhuma policy: quem lê e escreve é o service-role do repositório, depois de
-- conferir a posse da aula. RLS ligada é o que garante que `authenticated` não
-- alcance a tabela por fora.
alter table public.class_session_locks enable row level security;

-- Migra a trava que estiver viva no momento (TTL de 60s — o resto é lixo).
insert into public.class_session_locks (session_id, locked_by, locked_at)
select id, locked_by, locked_at
  from public.class_sessions
 where locked_by is not null
   and locked_at > now() - interval '60 seconds'
on conflict (session_id) do nothing;

-- As colunas velhas de `class_sessions` saem na 0043, separada de propósito:
-- derrubar coluna é irreversível, e a partir daqui nada mais lê ou escreve
-- nelas. Deixá-las órfãs por um tempo não custa nada e dá margem para voltar
-- atrás sem restaurar backup.
