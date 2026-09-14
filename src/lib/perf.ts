/**
 * Modo leve.
 *
 * O sistema roda em máquina de escola e em celular antigo, não só no notebook
 * de quem o desenvolve. O que derruba esse hardware não é o tamanho do banco:
 * é GPU — `backdrop-filter` em painel grande, sombra difusa, canvas WebGL,
 * animação contínua. Tudo isso é enfeite, e enfeite não pode ser o motivo de
 * alguém não conseguir marcar uma chamada.
 *
 * O modo leve desliga esse andar decorativo inteiro e não toca em mais nada:
 * nenhuma tela some, nenhum botão muda de lugar, nenhum dado deixa de chegar.
 *
 * Ele é decidido UMA vez, antes da primeira pintura, e vira `data-perf="lite"`
 * no `<html>` — daí o CSS resolve quase tudo sozinho, sem custo de runtime.
 */

export const PERF_STORAGE_KEY = "du:perf";
export type PerfMode = "lite" | "full";

/**
 * Roda inline no `<head>`, antes de qualquer pintura — por isso é texto e não
 * um módulo: precisa executar antes do React existir, senão a tela pisca com
 * os efeitos ligados antes de desligá-los.
 *
 * A escolha explícita do usuário sempre ganha. Sem ela, vale a heurística:
 *
 *   - `saveData`            — o usuário pediu economia ao navegador;
 *   - `deviceMemory <= 4`   — 4 GB ou menos de RAM;
 *   - `hardwareConcurrency <= 4` — até 4 núcleos;
 *   - `prefers-reduced-motion` — quem pede menos movimento não quer WebGL.
 *
 * Os dois primeiros sinais não existem no Safari/Firefox, e é por isso que a
 * heurística é generosa em vez de exata: errar para o lado leve custa um
 * degradê menos bonito; errar para o outro trava a máquina de quem trabalha.
 */
export const PERF_INIT_SCRIPT = `
(function () {
  try {
    var saved = localStorage.getItem(${JSON.stringify(PERF_STORAGE_KEY)});
    var lite;
    if (saved === "lite" || saved === "full") {
      lite = saved === "lite";
    } else {
      var nav = navigator;
      var conn = nav.connection || {};
      lite =
        conn.saveData === true ||
        (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4) ||
        (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 4) ||
        matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    if (lite) document.documentElement.setAttribute("data-perf", "lite");
  } catch (e) {
    // Storage bloqueado ou API ausente: segue no modo completo.
  }
})();
`.trim();

/**
 * Leitura direta do modo, para código que roda dentro de um efeito e não tem
 * como usar o hook — as animações decorativas de GSAP, por exemplo, que são
 * criadas imperativamente e não pelo render.
 *
 * O CSS do modo leve já zera animação e transição declaradas em folha de
 * estilo, mas GSAP anima por JavaScript: ele passa por fora dessa regra e
 * precisa ser barrado na origem.
 */
export function isLiteMode(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.getAttribute("data-perf") === "lite";
}
