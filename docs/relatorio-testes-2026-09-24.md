# Relatório de testes — Du Inglês

**Data:** 24/09/2026
**Ambiente:** Windows, Node.js v24.16.0, k6 v2.2.0, Docker Engine 29.8.0 e PostgreSQL 17 no Testcontainers.
**Escopo:** arquitetura, integração com banco, carga HTTP e benchmark de validação.

## Resumo

| Teste                         | Resultado                | Evidência                                                                                                                |
| ----------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Arquitetura                   | **Aprovado**             | 1 teste, 0 falhas; nenhuma dependência proibida encontrada.                                                              |
| Frequência por turma          | **Aprovado**             | 1 teste unitário; cobre presença, atraso, ausência e aula não concluída.                                                 |
| Integração com Testcontainers | **Aprovado**             | 1 teste, 0 falhas; política RLS aceita o caso autorizado e rejeita três acessos indevidos.                               |
| Carga HTTP local              | **Smoke aprovado**       | 24 requisições, 0 erros HTTP, 48/48 verificações aprovadas.                                                              |
| Smoke autenticado pós ajustes | **Aprovado**             | 87 requisições, 0 erros HTTP, 167/167 verificações aprovadas, 0 iterações descartadas; p95 global 256 ms.                |
| Carga autenticada em produção | **Degradação observada** | Até 500 VUs de navegação; timeouts após a subida para 300 VUs. [Relatório detalhado](relatorio-carga-500-2026-09-24.md). |
| Benchmark                     | **Medição concluída**    | 27.036,3 validações/s; p50 de 0,028 ms e p95 de 0,0473 ms.                                                               |

## 1. Teste de arquitetura

**Comando:** `npm run test:architecture`
**Resultado:** 1 teste aprovado, 0 falhas; duração total de 309 ms.

O [teste de arquitetura](../tests/architecture.test.mjs) analisa os imports e
reexports de arquivos TypeScript. As regras verificadas são:

- `schemas` não depende de `repositories`, `services`, `components` ou `app`;
- `repositories` não depende de `services`, `components` ou `app`;
- `services` não depende de `components` ou `app`.

É o equivalente prático ao ArchUnit para a estrutura TypeScript deste projeto.
O teste verifica dependências declaradas no código; ele não mede comportamento
em execução.

## 2. Integração com Testcontainers

**Comando:** `npm run test:integration`
**Resultado:** 1 teste aprovado, 0 falhas; duração total de 2,95 s na repetição
de 24/09/2026.

O [teste de integração](../tests/integration/submissions-rls.test.mjs) inicia um
PostgreSQL 17 temporário e aplica a migration real
[`20260918_submissions_insert_own_scope.sql`](../supabase/migrations/20260918_submissions_insert_own_scope.sql).
Depois, executa inserts com o papel `authenticated`:

| Cenário                               | Esperado           | Observado        |
| ------------------------------------- | ------------------ | ---------------- |
| Aluno da organização e turma corretas | Inserção permitida | Permitida        |
| Outro aluno                           | Inserção negada    | Negada (`42501`) |
| Outra organização                     | Inserção negada    | Negada (`42501`) |
| Outra turma                           | Inserção negada    | Negada (`42501`) |

Ao final, havia somente uma entrega gravada. O fixture contém apenas as tabelas
e funções necessárias a essa política; este teste não valida toda a instalação
local do Supabase nem todas as migrations.

## 3. Teste de carga HTTP

**Comando executado:**

```powershell
k6 run -e BASE_URL=http://localhost:3100 -e VUS=2 -e DURATION=15s `
  --summary-export loadtest/results/local-smoke.json loadtest/public-smoke.js
```

**Alvo:** landing page (`GET /`) em `next dev`, após a primeira compilação.
**Resultado:** smoke aprovado.

| Métrica                        |    Resultado |
| ------------------------------ | -----------: |
| Usuários virtuais              |            2 |
| Duração configurada            |         15 s |
| Requisições / iterações        |           24 |
| Vazão observada                |   1,52 req/s |
| Falhas HTTP                    |           0% |
| Verificações (HTTP 200 e HTML) | 48/48 (100%) |
| Latência média                 |    304,29 ms |
| Latência mediana               |    278,89 ms |
| Latência p95                   |    444,90 ms |
| Latência máxima                |    496,12 ms |

O resumo bruto está em `loadtest/results/local-smoke.json` (arquivo local
ignorado pelo Git). Este ensaio valida o script e o caminho HTTP público.
**Não estabelece a capacidade da aplicação em produção:** usou apenas dois
usuários virtuais e o servidor de desenvolvimento.

Esta medição local não incluiu os cenários autenticados. Eles foram executados
depois em produção, mediante autorização específica; o resultado está no
[relatório de carga até 500 VUs](relatorio-carga-500-2026-09-24.md).

### Smoke autenticado após ajustes de desempenho

O build de produção foi servido localmente em `http://localhost:3101`, com o
Supabase existente e as três contas sintéticas. O diagnóstico usou três VUs de
navegação (aluno, professor e admin), até cinco trabalhadores de CSV e uma
requisição CSV por segundo durante o pico. Em 24/09/2026, completou 87
requisições HTTP, todas com status 200; 167/167 checks passaram, sem iterações
descartadas. O p95 global do k6 foi 256 ms. O relatório detalhado local está em
`loadtest/results/diagnostic-20260924-051118-report.md` (ignorado pelo Git).

Esse smoke confirma que os fluxos autenticados seguem funcionais com baixa
concorrência. Não demonstra ganho de latência em relação à versão anterior nem
capacidade para 500 VUs. A repetição em homologação depende do ambiente e das
métricas de infraestrutura descritos no [plano](plano-melhorias-performance-2026-09-24.md).

## 4. Benchmark de desempenho

**Comando:** `npm run bench`
**Objeto medido:** `questionDraftListSchema.safeParse` com 50 questões mistas.
**Configuração:** 500 execuções de aquecimento e 5.000 execuções medidas.

| Métrica                    | Resultado |
| -------------------------- | --------: |
| Tempo total medido         | 184,94 ms |
| Operações por segundo      |  27.036,3 |
| Latência p50 por validação |  0,028 ms |
| Latência p95 por validação | 0,0473 ms |

O [benchmark](../benchmarks/assignment-validation.mts) mede CPU da validação
Zod no Node.js. Não inclui rede, banco, renderização Next.js ou concorrência.
Para identificar regressões, compare execuções na mesma máquina e versão do
Node, usando o mesmo número de iterações.

## Verificações complementares e pendências

- `npm run typecheck`: aprovado.
- `npm run lint`: aprovado.
- `npm run build`, `npm run test:architecture`, `npm run test:unit` e
  `npm run test:integration`: aprovados após os ajustes.
- O Prettier passou nos arquivos desta etapa. `npm run format:check` global
  ainda encontra 13 arquivos antigos fora do padrão; a verificação global não
  bloqueia o CI enquanto essa formatação é tratada separadamente.
- A carga autenticada foi executada em produção e interrompida após a
  degradação. O teste de pico sustentado e o diagnóstico de infraestrutura
  ainda exigem observabilidade de Vercel/Supabase e, preferencialmente, um
  ambiente de homologação equivalente. Consulte o
  [relatório específico](relatorio-carga-500-2026-09-24.md).
