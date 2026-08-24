-- ---------------------------------------------------------------------------
-- Foto de perfil (avatares)
--
-- Bucket privado com o retrato de cada pessoa. O caminho é sempre
-- `orgId/userId/arquivo` e fica guardado em `profiles.avatar_url`; quem serve
-- a imagem é `/api/avatars/[...path]`, que confere a sessão e devolve um
-- redirect para uma signed URL curta.
--
-- Limite de 2 MB: um retrato de 512px em JPG/WEBP não passa de algumas
-- centenas de KB, e o corte é feito no cliente antes do upload. O limite vive
-- aqui (Storage recusa no servidor) e em `src/lib/avatars.ts` (mensagem
-- amigável antes de gastar a banda).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Sem policy para `authenticated`: como em `lesson-assets`, todo acesso passa
-- pelo service-role atrás de rota autenticada.
