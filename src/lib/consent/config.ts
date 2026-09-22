/**
 * Consentimento de cookies e armazenamento local (LGPD art. 7 I, art. 8;
 * Guia Orientativo de Cookies da ANPD, 2022).
 *
 * Este arquivo é a fonte única do que a plataforma guarda no navegador: o
 * banner, a janela de preferências e a página `/cookies` leem daqui. Entrou um
 * cookie ou uma chave de `localStorage` nova? Ela precisa estar em `COOKIE_INVENTORY`
 * — senão a política publicada deixa de dizer a verdade.
 *
 * Regras que o resto do código segue:
 *
 *   - "necessary" nunca depende de aceite: sem ele não há login, e a própria
 *     escolha de cookies precisa ser lembrada.
 *   - Toda outra categoria começa DESLIGADA. Nada é lido nem gravado antes do
 *     "sim" — nem lido, porque ler o terminal do usuário já é tratamento.
 *   - Recusar (ou revogar depois) apaga o que já tinha sido gravado.
 *   - Mudou `CONSENT_VERSION` (entrou categoria ou finalidade nova)? A escolha
 *     antiga deixa de valer e o banner pergunta de novo.
 */

export const CONSENT_COOKIE = "du_consent";

/** Data da última mudança material nas finalidades. Trocar força novo aceite. */
export const CONSENT_VERSION = "2026-09-21";

/** A escolha vale por 6 meses; depois o banner volta a perguntar. */
export const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export type ConsentCategory = "necessary" | "preferences" | "analytics" | "marketing";
export type OptionalCategory = Exclude<ConsentCategory, "necessary">;

export const OPTIONAL_CATEGORIES: readonly OptionalCategory[] = [
  "preferences",
  "analytics",
  "marketing",
];

export type ConsentChoices = Record<OptionalCategory, boolean>;

export const NO_CONSENT: ConsentChoices = {
  preferences: false,
  analytics: false,
  marketing: false,
};

export interface ConsentState {
  version: string;
  /** Identificador aleatório deste navegador — liga a escolha ao registro no banco. */
  id: string;
  choices: ConsentChoices;
  /** Epoch em ms da decisão. */
  decidedAt: number;
}

export interface CategoryInfo {
  id: ConsentCategory;
  label: string;
  description: string;
  required: boolean;
}

export const CONSENT_CATEGORIES: readonly CategoryInfo[] = [
  {
    id: "necessary",
    label: "Estritamente necessários",
    description:
      "Mantêm você conectado, protegem o login e lembram a sua escolha sobre cookies. Sem eles a plataforma não funciona, por isso não podem ser desligados.",
    required: true,
  },
  {
    id: "preferences",
    label: "Preferências",
    description:
      "Lembram escolhas de interface neste aparelho: a vista da agenda, a aba aberta no planejador, cartões ou lista, o modo leve e as notificações já vistas. Desligados, tudo funciona igual — só volta ao padrão a cada visita.",
    required: false,
  },
  {
    id: "analytics",
    label: "Estatísticas",
    description: "Medem como o site é usado, de forma agregada.",
    required: false,
  },
  {
    id: "marketing",
    label: "Marketing",
    description: "Personalizam anúncios e medem campanhas.",
    required: false,
  },
];

export interface CookieItem {
  /** Nome do cookie, ou padrão da chave de armazenamento. */
  name: string;
  kind: "cookie" | "localStorage";
  category: ConsentCategory;
  provider: string;
  purpose: string;
  duration: string;
}

export const COOKIE_INVENTORY: readonly CookieItem[] = [
  {
    name: "sb-*-auth-token",
    kind: "cookie",
    category: "necessary",
    provider: "Du Inglês (Supabase)",
    purpose: "Sessão de login. Identifica quem está conectado a cada página.",
    duration: "Até sair da conta ou a sessão expirar",
  },
  {
    name: "google_oauth_state",
    kind: "cookie",
    category: "necessary",
    provider: "Du Inglês",
    purpose:
      "Proteção contra falsificação durante a conexão com o Google Agenda. Só existe se você iniciar essa conexão.",
    duration: "10 minutos",
  },
  {
    name: CONSENT_COOKIE,
    kind: "cookie",
    category: "necessary",
    provider: "Du Inglês",
    purpose: "Guarda a sua escolha sobre cookies e a versão desta política.",
    duration: "6 meses",
  },
  {
    name: "du:perf",
    kind: "localStorage",
    category: "preferences",
    provider: "Du Inglês",
    purpose: "Modo leve ligado ou desligado neste aparelho.",
    duration: "Até você mudar ou revogar",
  },
  {
    name: "du:agenda:v1",
    kind: "localStorage",
    category: "preferences",
    provider: "Du Inglês",
    purpose: "Vista e filtros da agenda.",
    duration: "Até você mudar ou revogar",
  },
  {
    name: "du:planejador:*",
    kind: "localStorage",
    category: "preferences",
    provider: "Du Inglês",
    purpose: "Última aba e pasta abertas no planejador.",
    duration: "Até você mudar ou revogar",
  },
  {
    name: "du:turmas:modo, du:alunos:modo, du:planos:modo",
    kind: "localStorage",
    category: "preferences",
    provider: "Du Inglês",
    purpose: "Exibição em cartões ou em lista.",
    duration: "Até você mudar ou revogar",
  },
  {
    name: "notifications:seen:*",
    kind: "localStorage",
    category: "preferences",
    provider: "Du Inglês",
    purpose: "Quando você abriu o sino pela última vez, para não repetir o aviso.",
    duration: "Até você mudar ou revogar",
  },
];

/**
 * Prefixos de `localStorage` apagados quando a categoria é recusada. Mantidos
 * ao lado do inventário para os dois não se desencontrarem.
 */
export const STORAGE_PREFIXES: Record<OptionalCategory, readonly string[]> = {
  preferences: ["du:", "notifications:seen:"],
  analytics: [],
  marketing: [],
};

/** Chaves antigas, gravadas antes deste mecanismo existir. */
export const LEGACY_STORAGE_KEYS = ["du_cookie_consent"] as const;

/** Só aparecem no banner as categorias que a plataforma de fato usa. */
export function categoriesInUse(): CategoryInfo[] {
  return CONSENT_CATEGORIES.filter(
    (category) =>
      category.required || COOKIE_INVENTORY.some((item) => item.category === category.id),
  );
}

export function serializeConsent(state: ConsentState): string {
  const { preferences, analytics, marketing } = state.choices;
  return encodeURIComponent(
    JSON.stringify({
      v: state.version,
      id: state.id,
      t: state.decidedAt,
      p: preferences ? 1 : 0,
      a: analytics ? 1 : 0,
      m: marketing ? 1 : 0,
    }),
  );
}

/** `null` quando não há escolha válida para a versão atual — o banner pergunta. */
export function parseConsent(raw: string | undefined | null): ConsentState | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
    if (data.v !== CONSENT_VERSION || typeof data.id !== "string") return null;
    return {
      version: CONSENT_VERSION,
      id: data.id,
      decidedAt: typeof data.t === "number" ? data.t : 0,
      choices: {
        preferences: data.p === 1,
        analytics: data.a === 1,
        marketing: data.m === 1,
      },
    };
  } catch {
    return null;
  }
}

/**
 * Trecho para scripts inline que rodam antes do React (ver `lib/perf.ts`) —
 * cole dentro de uma função, para as variáveis não vazarem para `window`:
 * define `__duPrefsOk`, verdadeiro só com aceite de "preferências" na versão
 * atual. Espelha `parseConsent` sem depender de módulo nenhum.
 */
export const CONSENT_INLINE_CHECK = `
var __duPrefsOk = false;
try {
  var __m = document.cookie.match(/(?:^|; )${CONSENT_COOKIE}=([^;]*)/);
  if (__m) {
    var __c = JSON.parse(decodeURIComponent(__m[1]));
    __duPrefsOk = __c.v === ${JSON.stringify(CONSENT_VERSION)} && __c.p === 1;
  }
} catch (e) {}
`.trim();
