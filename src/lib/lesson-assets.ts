import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * Imagens coladas dentro de uma aula. Ficam no Storage, nunca embutidas no
 * JSON do documento: um `data:` URL de 2 MB inflaria cada leitura do plano e
 * cada snapshot de versão da aula ao vivo.
 *
 * O bucket é privado (§6, conteúdo pedagógico não é público) — o documento
 * guarda só o caminho, servido por `/api/lesson-assets/[...path]`, que checa
 * a sessão antes de redirecionar para uma signed URL curta.
 */
export const LESSON_ASSETS_BUCKET = "lesson-assets";

const SIGNED_URL_TTL_SECONDS = 300;
const MAX_BYTES = 4 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export interface UploadedAsset {
  path: string;
  /** URL para colocar no `src` — sempre relativa, resolvida pela rota autenticada. */
  url: string;
}

/**
 * Cria o bucket no primeiro upload. A alternativa (exigir a migration
 * aplicada antes) transformaria "colar uma imagem" em erro silencioso num
 * ambiente recém-provisionado — e criar bucket é idempotente.
 */
async function ensureBucket(admin: ReturnType<typeof createAdminSupabaseClient>) {
  const { error } = await admin.storage.createBucket(LESSON_ASSETS_BUCKET, {
    public: false,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: Object.keys(EXTENSIONS),
  });
  // "already exists" é o caminho feliz de todas as chamadas depois da primeira.
  if (error && !/exist/i.test(error.message)) throw error;
}

/** Nome de pasta seguro: só o que a aplicação gera (`plano-<uuid>`). */
export function safeScope(scope: string): string {
  return /^[a-zA-Z0-9-]{1,64}$/.test(scope) ? scope : "geral";
}

export async function uploadLessonImage(
  organizationId: string,
  scope: string,
  bytes: ArrayBuffer | Buffer,
  mimeType: string,
): Promise<{ asset?: UploadedAsset; error?: string }> {
  const extension = EXTENSIONS[mimeType];
  if (!extension) return { error: "Formato não suportado (use PNG, JPG, WEBP ou GIF)." };

  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (buffer.byteLength === 0) return { error: "Imagem vazia." };
  if (buffer.byteLength > MAX_BYTES) {
    return { error: "Imagem muito grande (máximo 4 MB)." };
  }

  const admin = createAdminSupabaseClient();
  try {
    await ensureBucket(admin);
  } catch {
    return { error: "Armazenamento indisponível." };
  }

  const path = `${organizationId}/${safeScope(scope)}/${crypto.randomUUID()}.${extension}`;
  const { error } = await admin.storage
    .from(LESSON_ASSETS_BUCKET)
    .upload(path, buffer, { contentType: mimeType, upsert: false });

  if (error) return { error: "Falha ao enviar a imagem." };

  return { asset: { path, url: `/api/lesson-assets/${path}` } };
}

export async function getLessonAssetUrl(path: string): Promise<string | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.storage
    .from(LESSON_ASSETS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}
