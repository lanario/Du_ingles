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

/** Países oferecidos no seletor do telefone. O Brasil (+55) é o padrão. */
export const PHONE_COUNTRIES = [
  { ddi: "55", flag: "🇧🇷", name: "Brasil" },
  { ddi: "351", flag: "🇵🇹", name: "Portugal" },
  { ddi: "1", flag: "🇺🇸", name: "EUA / Canadá" },
  { ddi: "44", flag: "🇬🇧", name: "Reino Unido" },
  { ddi: "34", flag: "🇪🇸", name: "Espanha" },
  { ddi: "39", flag: "🇮🇹", name: "Itália" },
  { ddi: "49", flag: "🇩🇪", name: "Alemanha" },
  { ddi: "33", flag: "🇫🇷", name: "França" },
  { ddi: "54", flag: "🇦🇷", name: "Argentina" },
  { ddi: "595", flag: "🇵🇾", name: "Paraguai" },
  { ddi: "598", flag: "🇺🇾", name: "Uruguai" },
  { ddi: "81", flag: "🇯🇵", name: "Japão" },
] as const;

export const DEFAULT_DDI = BR_DDI;

/** Máscara do número nacional: BR usa (DD) 99999-9999; os demais, blocos de 3-4. */
export function formatNationalNumber(ddi: string, value: string): string {
  if (ddi === BR_DDI) return formatPhoneInput(value);
  const digits = onlyDigits(value).slice(0, 15 - ddi.length);
  const groups: string[] = [];
  for (let index = 0; index < digits.length; index += 3) {
    groups.push(digits.slice(index, index + 3));
  }
  return groups.join(" ");
}

/** Separa um valor salvo (ou digitado) em DDI + número nacional. */
export function splitPhone(value: string | null | undefined): {
  ddi: string;
  national: string;
} {
  const raw = (value ?? "").trim();
  const digits = onlyDigits(raw);
  if (!digits) return { ddi: DEFAULT_DDI, national: "" };

  const explicitDdi = raw.startsWith("+") || (digits.startsWith(BR_DDI) && digits.length >= 12);
  if (explicitDdi) {
    const country = [...PHONE_COUNTRIES]
      .sort((a, b) => b.ddi.length - a.ddi.length)
      .find((entry) => digits.startsWith(entry.ddi));
    if (country) return { ddi: country.ddi, national: digits.slice(country.ddi.length) };
    return { ddi: DEFAULT_DDI, national: digits };
  }
  return { ddi: DEFAULT_DDI, national: digits };
}

/** "+55 (21) 96641-8522" — o valor que o formulário envia. Vazio sem número. */
export function composePhone(ddi: string, national: string): string {
  const digits = onlyDigits(national);
  if (!digits) return "";
  return `+${ddi} ${formatNationalNumber(ddi, digits)}`;
}
