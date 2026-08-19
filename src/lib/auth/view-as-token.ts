import "server-only";
import { requireViewAsSecret } from "@/lib/env";
import type { AppRole } from "@/types/domain";

/**
 * Cookie assinado (HMAC-SHA256) do modo "Ver como" (§3.3) — hoje aceita
 * tanto `teacher` quanto `student` como papel de pré-visualização. Usa
 * Web Crypto (`crypto.subtle`) em vez do módulo `node:crypto` porque o
 * middleware roda em Edge Runtime — `subtle` funciona nos dois ambientes.
 *
 * A ação que emite este token (`enterViewAsMode`) é da Fase 3. Aqui só vive
 * a primitiva de assinatura/verificação, já consumida por `getSessionContext`.
 */
export interface ViewAsPayload {
  role: AppRole;
  /** Perfil escolhido como referência da pré-visualização (professor ou aluno). */
  targetUserId?: string;
  exp: number;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const withPadding = padded + "=".repeat((4 - (padded.length % 4)) % 4);
  const binary = atob(withPadding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getHmacKey(): Promise<CryptoKey> {
  const secret = requireViewAsSecret();
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signViewAsToken(payload: ViewAsPayload): Promise<string> {
  const key = await getHmacKey();
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const sig = toBase64Url(new Uint8Array(signature));
  return `${body}.${sig}`;
}

export async function verifyViewAsToken(token: string): Promise<ViewAsPayload | null> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  try {
    const key = await getHmacKey();
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(sig) as BufferSource,
      new TextEncoder().encode(body),
    );
    if (!valid) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(body)),
    ) as ViewAsPayload;

    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
