import "server-only";

const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

/**
 * Senha temporária legível (sem 0/O/1/I/l, ambíguos ao ditar por telefone).
 * Garante ao menos um maiúsculo/minúsculo/dígito para bater com
 * `passwordRules` de `schemas/auth.ts`.
 */
export function generateTemporaryPassword(length = 12): string {
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  let password = Array.from(bytes, (b) => CHARS[b % CHARS.length]).join("");

  if (!/[a-z]/.test(password)) password = "a" + password.slice(1);
  if (!/[A-Z]/.test(password)) password = password.slice(0, 1) + "B" + password.slice(2);
  if (!/[0-9]/.test(password)) password = password.slice(0, 2) + "7" + password.slice(3);

  return password;
}
