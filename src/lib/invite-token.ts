import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Token do convite. Vai em claro só na URL entregue pelo WhatsApp; no banco
 * fica o SHA-256 — quem lê a tabela não consegue montar um link válido.
 *
 * 32 bytes aleatórios (256 bits) em base64url: inadivinhável por força
 * bruta e ainda curto o bastante para caber numa mensagem sem quebrar.
 */
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Comparação em tempo constante — o hash é segredo de autenticação. */
export function inviteTokenMatches(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashInviteToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
