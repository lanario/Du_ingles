"use client";

import { useSyncExternalStore } from "react";
import { recordCookieConsentAction } from "@/actions/shared/consent";
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_SECONDS,
  CONSENT_VERSION,
  LEGACY_STORAGE_KEYS,
  NO_CONSENT,
  OPTIONAL_CATEGORIES,
  STORAGE_PREFIXES,
  categoriesInUse,
  parseConsent,
  serializeConsent,
  type ConsentChoices,
  type ConsentState,
  type OptionalCategory,
} from "@/lib/consent/config";

/**
 * Estado do consentimento no navegador. O cookie `du_consent` é a fonte da
 * verdade (o servidor e o script inline do `<head>` também o leem); este
 * módulo só guarda uma cópia em memória para o `useSyncExternalStore` ter
 * uma referência estável entre renders.
 */

const OPEN_EVENT = "du:open-cookie-preferences";
const listeners = new Set<() => void>();

let cachedRaw: string | null | undefined;
let cachedState: ConsentState | null = null;

function readCookie(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`));
  return match?.[1] ?? null;
}

export function readConsent(): ConsentState | null {
  if (typeof document === "undefined") return null;
  const raw = readCookie();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedState = parseConsent(raw);
  }
  return cachedState;
}

/** Sem decisão registrada vale "não" — o silêncio nunca é aceite. */
export function hasConsent(category: OptionalCategory): boolean {
  return readConsent()?.choices[category] ?? false;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/**
 * `undefined` no servidor e no primeiro render do cliente (ninguém sabe ainda);
 * `null` quando o navegador não decidiu; o estado quando decidiu.
 */
export function useConsent(): ConsentState | null | undefined {
  return useSyncExternalStore(subscribe, readConsent, () => undefined);
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

/** Apaga o que cada categoria recusada tinha gravado. */
function purgeStorage(choices: ConsentChoices) {
  try {
    const storage = window.localStorage;
    for (const key of LEGACY_STORAGE_KEYS) storage.removeItem(key);

    const prefixes = OPTIONAL_CATEGORIES.filter((category) => !choices[category]).flatMap(
      (category) => STORAGE_PREFIXES[category],
    );
    if (prefixes.length === 0) return;

    // Coleta antes de remover: apagar durante o laço desloca os índices.
    const doomed: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && prefixes.some((prefix) => key.startsWith(prefix))) doomed.push(key);
    }
    doomed.forEach((key) => storage.removeItem(key));
  } catch {
    // Storage bloqueado: não há o que apagar.
  }
}

export function saveConsent(choices: ConsentChoices) {
  const previous = readConsent();
  const state: ConsentState = {
    version: CONSENT_VERSION,
    id: previous?.id ?? randomId(),
    choices,
    decidedAt: Date.now(),
  };

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${serializeConsent(state)}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;

  purgeStorage(choices);

  // Quem revogou "preferências" com o modo leve forçado volta à detecção
  // automática já no próximo carregamento — o atributo da página atual fica.
  listeners.forEach((onChange) => onChange());

  // Prova do consentimento (art. 8 §2). Falhar aqui não pode travar a tela:
  // a escolha já vale no navegador.
  void recordCookieConsentAction({
    consentId: state.id,
    version: state.version,
    choices,
  }).catch(() => undefined);
}

/**
 * "Aceitar" concede só o que a plataforma usa hoje. Uma categoria que ainda
 * não existe não pode ser aceita de antemão: quando ela entrar, sobe a
 * `CONSENT_VERSION` e a pessoa decide de novo.
 */
export function acceptAll() {
  const inUse = new Set(categoriesInUse().map((category) => category.id));
  saveConsent({
    preferences: inUse.has("preferences"),
    analytics: inUse.has("analytics"),
    marketing: inUse.has("marketing"),
  });
}

export function rejectOptional() {
  saveConsent({ ...NO_CONSENT });
}

/** Abre a janela de preferências de qualquer lugar (rodapé, "Meus dados"). */
export function openCookiePreferences() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function onOpenCookiePreferences(handler: () => void) {
  window.addEventListener(OPEN_EVENT, handler);
  return () => window.removeEventListener(OPEN_EVENT, handler);
}

/**
 * `localStorage` condicionado ao aceite de "preferências". Sem aceite, ler
 * devolve `null` e gravar não faz nada — a tela funciona com o padrão, como
 * num navegador em modo privado. Todo acesso de preferência de interface
 * passa por aqui; `localStorage` direto só para o que for necessário.
 */
export const preferenceStorage = {
  get(key: string): string | null {
    if (!hasConsent("preferences")) return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    if (!hasConsent("preferences")) return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Cota cheia ou modo privado: a escolha vale só nesta visita.
    }
  },
  remove(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // idem
    }
  },
};
