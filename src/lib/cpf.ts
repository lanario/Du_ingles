/**
 * CPF. Guardamos sempre em dígitos (`onlyDigits`); a máscara é assunto de
 * apresentação. Roda no cliente e no servidor de propósito: o formulário
 * valida enquanto o usuário digita e a server action revalida, sem duas
 * implementações que possam divergir.
 */

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** 000.000.000-00 — formata parcial, então serve para máscara ao digitar. */
export function formatCpf(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/**
 * Dígitos verificadores (módulo 11). Rejeita também os onze dígitos iguais
 * ("111.111.111-11" passa no cálculo, mas não é CPF de ninguém).
 */
export function isValidCpf(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const checkDigit = (length: number): number => {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += Number(digits[i]) * (length + 1 - i);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return checkDigit(9) === Number(digits[9]) && checkDigit(10) === Number(digits[10]);
}
