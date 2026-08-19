/**
 * Força de senha para o medidor do cadastro. As quatro primeiras exigências
 * são exatamente as de `passwordRules` (`schemas/auth.ts`) — o medidor não
 * pode dizer "boa" para uma senha que a validação vai recusar. As duas
 * últimas são bônus: não bloqueiam, só empurram para cima.
 */

export interface PasswordCheck {
  id: string;
  label: string;
  met: boolean;
  /** Exigido pelo schema — sem ele o cadastro não passa. */
  required: boolean;
}

export type PasswordLevel = "empty" | "weak" | "fair" | "good" | "strong";

export interface PasswordStrength {
  level: PasswordLevel;
  label: string;
  /** 0 a 4 — quantos blocos do medidor acendem. */
  score: number;
  checks: PasswordCheck[];
  /** Todas as exigências obrigatórias atendidas. */
  valid: boolean;
}

const LABELS: Record<PasswordLevel, string> = {
  empty: "",
  weak: "Fraca",
  fair: "Razoável",
  good: "Boa",
  strong: "Forte",
};

export function checkPassword(password: string): PasswordStrength {
  const checks: PasswordCheck[] = [
    {
      id: "length",
      label: "Mínimo de 8 caracteres",
      met: password.length >= 8,
      required: true,
    },
    {
      id: "lower",
      label: "Uma letra minúscula",
      met: /[a-z]/.test(password),
      required: true,
    },
    {
      id: "upper",
      label: "Uma letra maiúscula",
      met: /[A-Z]/.test(password),
      required: true,
    },
    { id: "number", label: "Um número", met: /[0-9]/.test(password), required: true },
    {
      id: "symbol",
      label: "Um símbolo (!@#$…)",
      met: /[^A-Za-z0-9]/.test(password),
      required: false,
    },
    {
      id: "long",
      label: "12 caracteres ou mais",
      met: password.length >= 12,
      required: false,
    },
  ];

  const valid = checks.every((check) => !check.required || check.met);

  if (password.length === 0) {
    return { level: "empty", label: LABELS.empty, score: 0, checks, valid: false };
  }

  const met = checks.filter((check) => check.met).length;
  // Enquanto faltar exigência obrigatória, a senha é fraca por definição —
  // seis caracteres com símbolo não podem parecer melhores do que são.
  const level: PasswordLevel = !valid
    ? "weak"
    : met >= 6
      ? "strong"
      : met === 5
        ? "good"
        : "fair";

  const score = { empty: 0, weak: 1, fair: 2, good: 3, strong: 4 }[level];

  return { level, label: LABELS[level], score, checks, valid };
}
