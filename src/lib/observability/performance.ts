/**
 * Métricas leves para os logs de runtime. Operações devem ser nomes estáticos;
 * nunca inclua IDs, URLs completas, tokens ou conteúdo de consultas.
 */
export function recordPerformance(
  operation: string,
  startedAt: number,
  outcome: "ok" | "error" = "ok",
  errorCode?: string,
): void {
  const durationMs = Math.round(performance.now() - startedAt);
  const slow = durationMs >= 1_000;
  const sampleRate = slow ? 0.2 : 0.05;
  if (outcome === "ok" && Math.random() >= sampleRate) return;

  const entry = {
    event: "server_performance",
    operation,
    durationMs,
    outcome,
    ...(errorCode ? { errorCode } : {}),
  };
  if (outcome === "error") console.error(JSON.stringify(entry));
  else if (slow) console.warn(JSON.stringify(entry));
  else console.info(JSON.stringify(entry));
}

/** Registra duração inclusive quando a operação lança exceção. */
export async function measureServer<T>(
  operation: string,
  action: () => Promise<T>,
): Promise<T> {
  const startedAt = performance.now();
  try {
    const result = await action();
    recordPerformance(operation, startedAt);
    return result;
  } catch (error) {
    recordPerformance(operation, startedAt, "error");
    throw error;
  }
}

/** Supabase devolve erros no resultado em vez de lançar exceções. */
export async function measureDataQuery<T extends { error: { code?: string } | null }>(
  operation: string,
  action: () => PromiseLike<T>,
): Promise<T> {
  const startedAt = performance.now();
  try {
    const result = await action();
    recordPerformance(
      operation,
      startedAt,
      result.error ? "error" : "ok",
      result.error?.code,
    );
    return result;
  } catch (error) {
    recordPerformance(operation, startedAt, "error");
    throw error;
  }
}

/** Falhas de leituras secundárias que preservam a página com dados de reserva. */
export function recordDataError(operation: string, errorCode?: string): void {
  console.error(
    JSON.stringify({
      event: "server_data_error",
      operation,
      ...(errorCode ? { errorCode } : {}),
    }),
  );
}
