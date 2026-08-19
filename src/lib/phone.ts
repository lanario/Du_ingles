/**
 * Telefone brasileiro para WhatsApp. O número é a identidade do convite:
 * é para ele que o link vai, e é ele que aparece travado no cadastro.
 *
 * Formato canônico: só dígitos, com DDI — `5521999998888`. É o que a
 * `wa.me` espera e o que a coluna `user_invites.phone` guarda.
 */

const BR_DDI = "55";

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Normaliza o que o admin digitou para o formato canônico. Assume Brasil
 * quando vier sem DDI (o caso de 99% dos números digitados aqui), mas
 * preserva o DDI de quem digitou completo — aluno morando fora existe.
 */
export function normalizePhone(value: string): string {
  const digits = onlyDigits(value);
  if (digits.length === 10 || digits.length === 11) return BR_DDI + digits;
  return digits;
}

/** Um celular BR tem 11 dígitos + DDI; fixo tem 10. Fora disso, não dá para enviar. */
export function isValidPhone(value: string): boolean {
  const digits = normalizePhone(value);
  return digits.length >= 12 && digits.length <= 15;
}

/** (21) 99999-8888 — formata parcial, serve como máscara ao digitar. */
export function formatPhoneInput(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** +55 (21) 99999-8888 — exibição de um número já canônico. */
export function formatPhoneDisplay(canonical: string): string {
  const digits = onlyDigits(canonical);
  if (!digits.startsWith(BR_DDI) || digits.length < 12) return `+${digits}`;
  return `+${BR_DDI} ${formatPhoneInput(digits.slice(2))}`;
}

/**
 * Link do WhatsApp com a mensagem pronta. `wa.me` abre o app no celular e
 * o WhatsApp Web no desktop — o admin só confere e aperta enviar, que é
 * exatamente o envio manual que o fluxo pede.
 */
export function whatsappUrl(canonicalPhone: string, message: string): string {
  return `https://wa.me/${onlyDigits(canonicalPhone)}?text=${encodeURIComponent(message)}`;
}
