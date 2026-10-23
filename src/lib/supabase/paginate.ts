/**
 * O PostgREST corta respostas em `max_rows` (1000 por padrão) sem erro: uma
 * agregação em memória sobre uma tabela que cresceu passa a contar só a
 * primeira página. Esta função lê tudo em páginas.
 *
 * `page` deve ordenar por coluna única (`.order("id")`) — sem ordem estável,
 * `range` pode repetir ou pular linhas entre páginas.
 */
const PAGE_SIZE = 1000;

export async function fetchAllRows<Row, Err extends { code?: string } | null>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: Row[] | null; error: Err }>,
): Promise<{ data: Row[]; error: Err | null }> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) return { data: [], error };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return { data: rows, error: null };
}
