import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * Foto de perfil. Mesmo desenho de `lesson-assets`: o bucket é privado, o
 * banco guarda só o caminho (`orgId/userId/uuid.ext`) e a imagem sai por uma
 * rota autenticada que redireciona para uma signed URL curta.
 *
 * Um retrato é dado pessoal (§6) — deixar o bucket público exporia a foto de
 * todo aluno a quem adivinhasse o id.
 */
export const AVATARS_BUCKET = "avatars";

/** Limite versionado junto do bucket (`0029_avatars_bucket.sql`). */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_MAX_MB = AVATAR_MAX_BYTES / (1024 * 1024);

const SIGNED_URL_TTL_SECONDS = 300;

/**
 * Cache da signed URL em memória do processo, por caminho.
 *
 * Sem isto, uma tela com N avatares (lista de turma, roster do chat) disparava
 * N requests para `/api/avatars/...`, e cada um gerava uma signed URL NOVA no
 * Storage — round-trip ao Supabase por foto, toda vez que a lista carrega.
 * Path é conteúdo-endereçado (`uploadAvatar` gera um UUID novo a cada troca de
 * foto — ver `avatars.ts`), então a mesma URL assinada serve qualquer request
 * para o mesmo caminho até expirar; não há risco de servir foto desatualizada
 * porque uma foto trocada tem caminho novo, nunca o mesmo caminho com
 * conteúdo diferente.
 *
 * `SAFETY_MARGIN_SECONDS` deixa de reaproveitar a entrada um pouco antes do
 * Storage invalidar a URL de verdade — sem a margem, um request que chegasse
 * bem no limite serviria uma URL que expira no meio do download da imagem.
 *
 * Por processo (não compartilhado entre instâncias serverless): ajuda a
 * instância já aquecida, que é o caso comum (Vercel mantém a mesma instância
 * entre requests de uma sessão de navegação ativa); uma instância fria ainda
 * paga o custo cheio na primeira vez. Ainda assim, numa lista de N avatares
 * numa única instância, colapsa N chamadas ao Storage em no máximo 1 por
 * caminho distinto.
 */
const SAFETY_MARGIN_SECONDS = 30;
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export const AVATAR_MIME_TYPES = Object.keys(EXTENSIONS);

/**
 * Cria o bucket no primeiro upload — idempotente, e evita que um ambiente
 * recém-provisionado (sem a migration aplicada) transforme "trocar a foto"
 * em erro silencioso.
 */
async function ensureBucket(admin: ReturnType<typeof createAdminSupabaseClient>) {
  const { error } = await admin.storage.createBucket(AVATARS_BUCKET, {
    public: false,
    fileSizeLimit: AVATAR_MAX_BYTES,
    allowedMimeTypes: AVATAR_MIME_TYPES,
  });
  if (error && !/exist/i.test(error.message)) throw error;
}

export interface UploadedAvatar {
  /** Caminho no bucket — é isto que vai para `profiles.avatar_url`. */
  path: string;
  /** URL relativa servida pela rota autenticada. */
  url: string;
}

export function avatarPublicPath(path: string): string {
  return `/api/avatars/${path}`;
}

export async function uploadAvatar(
  organizationId: string,
  userId: string,
  bytes: ArrayBuffer | Buffer,
  mimeType: string,
): Promise<{ avatar?: UploadedAvatar; error?: string }> {
  const extension = EXTENSIONS[mimeType];
  if (!extension) return { error: "Formato não suportado (use PNG, JPG ou WEBP)." };

  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (buffer.byteLength === 0) return { error: "Imagem vazia." };
  if (buffer.byteLength > AVATAR_MAX_BYTES) {
    return { error: `Imagem muito grande (máximo ${AVATAR_MAX_MB} MB).` };
  }

  const admin = createAdminSupabaseClient();
  try {
    await ensureBucket(admin);
  } catch {
    return { error: "Armazenamento indisponível." };
  }

  const path = `${organizationId}/${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await admin.storage
    .from(AVATARS_BUCKET)
    .upload(path, buffer, { contentType: mimeType, upsert: false });

  if (error) return { error: "Falha ao enviar a imagem." };

  return { avatar: { path, url: avatarPublicPath(path) } };
}

/**
 * Apaga o arquivo antigo depois que o novo caminho já está no perfil — a foto
 * anterior não tem mais nenhuma referência, e mantê-la só acumularia lixo no
 * bucket. Falha silenciosa de propósito: um arquivo órfão não é motivo para
 * derrubar a troca de foto que já deu certo.
 */
export async function deleteAvatar(path: string): Promise<void> {
  if (!path) return;
  signedUrlCache.delete(path);
  const admin = createAdminSupabaseClient();
  await admin.storage.from(AVATARS_BUCKET).remove([path]);
}

export async function getAvatarSignedUrl(path: string): Promise<string | null> {
  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.storage
    .from(AVATARS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return null;

  signedUrlCache.set(path, {
    url: data.signedUrl,
    expiresAt: Date.now() + (SIGNED_URL_TTL_SECONDS - SAFETY_MARGIN_SECONDS) * 1000,
  });
  return data.signedUrl;
}
