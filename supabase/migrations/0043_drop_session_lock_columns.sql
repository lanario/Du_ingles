-- Limpeza da 0042: as colunas de trava saem de `class_sessions`.
--
-- Separada da 0042 porque é irreversível. Desde a 0042 ninguém lê nem escreve
-- nelas (`repositories/live-session.ts` usa `class_session_locks`), então a
-- única coisa que esta migration muda é o peso da linha — que era justamente
-- o problema: a aula carrega o documento inteiro em `content`, e o batimento
-- de 30 em 30 segundos reescrevia tudo isso no WAL para renovar um timestamp.
--
-- Nada a preservar: a trava vale 60 segundos e a 0042 já migrou a que estivesse
-- viva.

alter table public.class_sessions
  drop column if exists locked_by,
  drop column if exists locked_at;
