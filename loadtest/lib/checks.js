import { check } from "k6";

/**
 * Confere que a página autenticada carregou de verdade, e não caiu num
 * redirect pro /login — o que aconteceria em silêncio (HTTP 200 na resposta
 * final, já que o k6 segue redirects por padrão) se a sessão simulada não
 * for reconhecida pelo middleware.
 */
export function expectAuthedPage(res, label) {
  return check(res, {
    [`${label}: HTTP 200`]: (r) => r.status === 200,
    [`${label}: manteve acesso autorizado`]: (r) =>
      !/\/(login|403)(?:[/?#]|$)/.test(r.url || ""),
  });
}
