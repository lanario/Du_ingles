/**
 * Ponto de entrada do vocabulário de notificações (ícone, tom, rótulo e
 * tempo relativo). Só reexporta `view.ts` porque este módulo é importado por
 * componentes de cliente — o que grava notificação mora em `dispatch.ts` e
 * `events.ts`, ambos `server-only`.
 */
export * from "./view";
