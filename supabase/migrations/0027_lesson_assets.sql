-- ---------------------------------------------------------------------------
-- Imagens do planejador de aulas
--
-- Bucket privado para o que é colado dentro de uma aula (Ctrl+V no canvas).
-- O documento guarda só o caminho `orgId/escopo/arquivo`; quem serve o
-- arquivo é `/api/lesson-assets/[...path]`, que confere a sessão e devolve um
-- redirect para uma signed URL de 5 minutos.
--
-- A aplicação cria este bucket no primeiro upload (service-role), então esta
-- migration é o registro explícito do que existe em produção — e o lugar onde
-- o limite de tamanho e os tipos aceitos ficam versionados.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lesson-assets',
  'lesson-assets',
  false,
  4194304,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Nenhuma policy para `authenticated`: o acesso é sempre pelo service-role,
-- atrás da rota autenticada. Ler o bucket direto do cliente não é um caminho
-- suportado — e sem policy, também não é possível.
