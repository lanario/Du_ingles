import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { requireTokenEncryptionKey } from "@/lib/env";

/**
 * Cifra o refresh token do Google antes de ir para o banco. Quem ler a
 * tabela (backup, dump, alguém com acesso ao painel) só enxerga texto
 * cifrado: sem `TOKEN_ENCRYPTION_KEY` o valor não serve para nada.
 *
 * AES-256-GCM: além de esconder, autentica. Um valor adulterado no banco
 * falha na abertura em vez de virar um token qualquer.
 * Formato guardado: `v1.<iv>.<tag>.<cifrado>`, cada parte em base64url.
 */

const VERSION = "v1";

function key(): Buffer {
  const raw = Buffer.from(requireTokenEncryptionKey(), "base64");
  if (raw.length !== 32) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY deve ser base64 de 32 bytes (openssl rand -base64 32).",
    );
  }
  return raw;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, ...[iv, tag, body].map((part) => part.toString("base64url"))].join(
    ".",
  );
}

export function decryptSecret(stored: string): string {
  const [version, iv, tag, body] = stored.split(".");
  if (version !== VERSION || !iv || !tag || !body) {
    throw new Error("Segredo cifrado em formato desconhecido.");
  }
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(body, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
