# Testes de arquitetura, integração e desempenho

## Arquitetura (equivalente ao ArchUnit para TypeScript)

```powershell
npm run test:architecture
```

O teste usa a árvore sintática do TypeScript para conferir imports e reexports.
`schemas` não pode depender de `repositories`, `services`, `components` ou
`app`; `repositories` não pode depender de `services`, `components` ou `app`;
`services` não pode depender de `components` ou `app`. Imports relativos e o
alias `@/` são cobertos. Uma violação exibe origem e destino.

## Integração com Testcontainers

Com Docker Desktop iniciado e o daemon Linux acessível:

```powershell
npm run test:integration
```

O teste inicia um PostgreSQL 17 descartável, aplica a migration
`20260918_submissions_insert_own_scope.sql` e executa inserts como o papel
`authenticated`. Confere que um aluno matriculado consegue entregar a tarefa
e que outro aluno, outra organização e outra turma são rejeitados pela RLS.
O fixture reproduz somente as tabelas e funções necessárias para essa política;
ele não substitui uma execução de todas as migrations no Supabase local.

## Benchmark de validação

```powershell
npm run bench
$env:BENCH_ITERATIONS = "10000"; npm run bench
```

Mede `questionDraftListSchema.safeParse` com 50 questões, após aquecimento,
e imprime operações por segundo e latências p50/p95. Compare resultados
sempre na mesma máquina e versão do Node. Para um limite local opcional,
defina `BENCH_MIN_OPS`; a execução falha se ficar abaixo dele. Esse benchmark
mede CPU da validação, não latência HTTP nem banco.

## Carga HTTP

Para validar o caminho público num servidor local:

```powershell
npm run dev -- -p 3100
k6 run -e BASE_URL=http://localhost:3100 -e VUS=2 -e DURATION=15s loadtest/public-smoke.js
```

Esse smoke verifica resposta 200 e HTML. Resultados de `next dev` servem para
validar o script, não para estabelecer capacidade. Para a carga autenticada
de aluno, professor e admin, siga [loadtest/README.md](../loadtest/README.md).
Ela exige `BASE_URL` explícita, contas sintéticas e chaves públicas do
Supabase. Execute em um ambiente preparado para carga e guarde o resumo k6
com a configuração usada para comparar execuções.
