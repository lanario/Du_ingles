/**
 * Vocabulário do relatório que servidor e cliente compartilham.
 *
 * Mora em `schemas/` — e não junto de `repositories/financial-reports.ts` —
 * porque a tela precisa dele em tempo de execução (os botões 3m/6m/12m) e o
 * repositório é `server-only`: importar a constante de lá arrastaria o
 * client service-role para o bundle do navegador.
 */

/** Janelas de tendência oferecidas no seletor. */
export const REPORT_WINDOWS = [3, 6, 12] as const;
export type ReportWindow = (typeof REPORT_WINDOWS)[number];

/** Valida a janela que chega pela query string. */
export function isReportWindow(value: number): value is ReportWindow {
  return (REPORT_WINDOWS as readonly number[]).includes(value);
}

/** Janela padrão: um semestre — o horizonte em que a escola revisa preço. */
export const DEFAULT_REPORT_WINDOW: ReportWindow = 6;
