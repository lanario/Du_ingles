# Plano de melhoria de desempenho e estabilidade

**Base:** [teste de carga de 24/09/2026](relatorio-carga-500-2026-09-24.md).
**Objetivo:** sustentar 500 usuários virtuais de navegação por cinco minutos, com latência e erros controlados, sem degradar o login após o teste.

## Andamento da primeira etapa

**Implementado em 24/09/2026 no workspace, ainda sem deploy:**

- Logs estruturados e amostrados de duração/erro para validação de sessão, perfil, layouts autenticados, painel admin e consultas de progresso; `instrumentation.ts` também registra erros de requisição não tratados por rota. Os registros têm nomes estáticos de operação e não incluem identidade, tokens ou dados de consulta.
- A leitura de perfil feita em `getSessionContext()` agora também alimenta os três layouts. Isso remove uma consulta de `profiles` por render de aluno, professor ou admin. O painel do aluno reutiliza o nome já presente na sessão, removendo mais uma consulta naquela página.
- Falhas nas leituras essenciais de próximas aulas, tarefas, progresso e painel admin deixam de ser interpretadas como listas/indicadores vazios. Erros de notificações e do perfil secundário são registrados, mantendo um resultado de reserva para esses elementos.
- O endpoint JWKS do projeto retornou uma chave pública **ES256**. Na verificação local, `getClaims()` levou cerca de 2–3 ms nas amostras registradas; não há evidência para priorizar uma migração de chave JWT.

**Validação local:** build de produção, typecheck, lint, teste de arquitetura e teste de integração com Testcontainers passaram. Um smoke no build local com as três contas sintéticas realizou **58 requisições, 0 falhas, 109/109 verificações aprovadas e p95 global de 309 ms**. Ele confirma comportamento e autorização básicos; não mede o ganho sob centenas de VUs.

**Ainda pendente na fase 1:** publicar as mudanças em ambiente apropriado e observar os logs sob carga controlada; correlacionar métricas históricas de Vercel/Supabase. O MCP do Supabase agora permite consultar contagens agregadas de logs, mas ainda não foram obtidos detalhes suficientes para fechar o diagnóstico; a conexão da Vercel foi iniciada pelo usuário, porém suas ferramentas ainda não aparecem no catálogo desta tarefa.

### Consulta ao MCP conectado em 24/09/2026

O MCP do Supabase ficou disponível nesta continuação. No projeto **Du Ingles** (`qxkqndnvacwoqnvofsth`), para **04:19–04:27 BRT de 24/09/2026**, a consulta agregada retornou 29.314 entradas `edge_logs`, 362 `postgres_logs`, 139 `postgrest_logs` e 17 `auth_logs`. Isso confirma que há registros no intervalo, mas a consulta agregada não fornece latências, códigos/mensagens por ocorrência nem métricas de CPU, I/O, conexões ou bloqueios necessárias para apontar o primeiro recurso saturado. Consultas de linhas detalhadas falharam no backend; não se deve inferir a causa a partir dessas contagens. O conector Vercel e a CLI `vercel` não estão disponíveis/configurados nesta sessão, então duração e concorrência de funções/middleware ainda dependem do acesso ao painel/logs da Vercel.

## Continuação no workspace em 24/09/2026

- O painel do aluno calcula a frequência por turma com os registros de presença já carregados. Isso elimina uma chamada `student_attendance_rate` por turma matriculada e mantém a fórmula usada no relatório administrativo: presenças e atrasos divididos pelas aulas concluídas. Um teste unitário cobre turma, ausência, atraso e aula ainda não concluída.
- A consulta de tarefas do painel seleciona apenas título, prazo, turma e status da submissão do aluno. A lista completa de tarefas também filtra a relação de submissões pelo aluno; ambas deixam de transferir as submissões de outros estudantes, e o painel deixa de transferir instruções e notas que não exibe.
- As consultas de listagem de turmas agora propagam erros de banco, e a busca por ID mantém `null` apenas para turma inexistente. Isso impede que uma falha de leitura apareça como ausência de turmas.
- Build, lint, typecheck, teste unitário, teste de arquitetura e teste de integração com Testcontainers passaram. No build local, o smoke autenticado com três VUs de navegação e até cinco trabalhadores para CSV executou **87 requisições HTTP, 0 falhas, 167/167 verificações aprovadas, 0 iterações descartadas e p95 global de 256 ms**. O resultado está em `loadtest/results/diagnostic-20260924-051118-report.md` (arquivo local ignorado pelo Git).

Essas mudanças ainda não foram publicadas. O smoke local valida fluxos e regressões com baixa concorrência; a comparação antes/depois sob carga e o critério de 500 VUs dependem de homologação e métricas de infraestrutura. A primeira tentativa desse smoke usou só um trabalhador de CSV e teve iterações descartadas por configuração do gerador; com cinco trabalhadores, o cenário passou sem descartes.

O Prettier passou nos arquivos desta etapa. A verificação global ainda aponta 13 arquivos antigos fora do padrão; ela não foi colocada como bloqueio de CI até a formatação desses arquivos ser tratada separadamente.

Após o deploy, filtre os logs por `event=server_performance` e agrupe por `operation`, `outcome` e faixas de `durationMs`. Compare `middleware.getClaims`, `session.profile`, `studentShell.*`, `dashboard.*`, `studentProgress.*` e `adminDashboard.*` durante o mesmo patamar de VUs. Falhas não tratadas usam `event=server_request_error`; leituras secundárias com resultado de reserva usam `event=server_data_error`. As durações de sucesso são amostradas (5% abaixo de 1 s; 20% a partir de 1 s); os erros são registrados integralmente.

## O que já sabemos

Até 150 VUs, o p95 por minuto ficou próximo de 1 segundo e não houve erros. Na subida para 300 VUs, o p95 chegou a 6,5 segundos; na subida seguinte surgiram timeouts de 60 segundos. O teste alcançou 500 VUs de navegação brevemente, acumulou 332 timeouts e foi interrompido. O login direto no Supabase também ficou lento após a carga e depois se recuperou.

As falhas atingiram aluno, professor e admin ao mesmo tempo. Isso sugere saturação de algum recurso compartilhado, mas **não identifica a causa**. O plano abaixo separa medição, correção e validação. Não há evidência suficiente para aumentar o plano de infraestrutura, adicionar índices ou trocar o método de autenticação de imediato.

## Fase 1 — Tornar o gargalo visível (prioridade P0; 1–3 dias)

1. Recuperar, se ainda disponíveis, as métricas e os logs de **04:19 a 04:27 BRT de 24/09/2026**: duração/concorrência das funções e middleware na Vercel; latência de Auth e PostgREST, CPU, I/O, conexões, sessões bloqueadas e consultas caras no Supabase. Salvar capturas e horários no relatório. [Vercel Observability](https://vercel.com/docs/observability), [Vercel Tracing](https://vercel.com/docs/tracing), [Supabase Reports](https://supabase.com/docs/guides/observability/reports).
2. Medir por etapa de requisição, com identificador de correlação e sem registrar tokens, cookies ou dados pessoais: middleware `getClaims()`, `getSessionContext()`, consulta a `profiles`, dados do layout, consultas do painel e tempo total. Os pontos de código iniciais são [`middleware.ts`](../src/middleware.ts), [`session.ts`](../src/lib/auth/session.ts), os três layouts autenticados e as páginas de entrada. A Vercel documenta spans de infraestrutura, fetch e render, além de instrumentação própria. [Vercel Tracing](https://vercel.com/docs/tracing).
3. Registrar **erros reais de banco** que hoje podem parecer listas vazias: por exemplo, [`listStudentAssignments`](../src/repositories/assignments.ts), [`listMyUpcomingSessions`](../src/repositories/class-sessions.ts) e [`groups.ts`](../src/repositories/groups.ts) retornam `[]` em certas falhas. Dar ao usuário um estado de erro/repetição apropriado e emitir log estruturado com nome da operação e código do erro. Não transformar falha de autorização em lista vazia.
4. Confirmar se o projeto usa chaves JWT assimétricas. O código chama `getClaims()` no middleware e no servidor; segundo a documentação do Supabase, com chave simétrica essa validação consulta o servidor Auth, e com chave assimétrica pode validar localmente usando JWKS. **Só planejar uma migração de chaves** após medir esse custo e revisar sessões/rotatividade. [Supabase `getClaims()`](https://supabase.com/docs/reference/javascript/auth-getclaims), [JWT Signing Keys](https://supabase.com/docs/guides/auth/signing-keys).

**Entrega:** gráfico de p50/p95/p99 e erros por rota e etapa; tabela das consultas com frequência, tempo total, p95 e número de linhas; diagnóstico escrito que aponte o primeiro recurso a saturar. Sem essa evidência, passar à fase 2 apenas nas mudanças de baixo risco de observabilidade e tratamento de erro.

## Fase 2 — Reduzir trabalho por requisição (prioridade P1; 3–7 dias após a medição)

Aplicar os itens abaixo **na ordem revelada pelas métricas**. Cada alteração precisa de comparação antes/depois na mesma massa de dados e de testes de autorização.

| Candidato                         | Evidência no código                                                                                                                                                                                                                                                                                                                                                     | Mudança planejada                                                                                                                                                                                                                   | Verificação                                                                                                                         |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Caminho comum de sessão e layouts | [`getSessionContext`](../src/lib/auth/session.ts) consulta `profiles` por render; layouts de aluno, professor e admin também leem notificações, contagem e perfil.                                                                                                                                                                                                      | Reaproveitar dados já disponíveis no contexto, eliminar buscas duplicadas e carregar dados secundários sem bloquear o conteúdo principal, quando a UX permitir. Preservar a checagem de papel e senha provisória.                   | Menos chamadas a Supabase por página, mesma autorização, nenhum dado de outro usuário.                                              |
| Painel admin                      | [`getAdminDashboard`](../src/repositories/dashboard.ts) lê linhas de dez tabelas em paralelo e agrega no Node; a [página admin](<../src/app/(admin)/admin/page.tsx>) força render dinâmico.                                                                                                                                                                             | Mover agregações de maior custo para consultas resumidas e escopadas por organização; limitar séries e rankings. Se a regra de negócio aceitar atualização em até 30 s, avaliar cache curto com invalidação nos eventos relevantes. | Volume de dados transferidos e tempo de query menores; números do painel idênticos aos atuais, inclusive após matrícula/financeiro. |
| Painel do aluno                   | A [página inicial](<../src/app/(app)/dashboard/page.tsx>) combina sessão, progresso e tarefas; [`getStudentProgress`](../src/repositories/progress.ts) lê todo o histórico de presença/notas do aluno e chama uma RPC por turma; [`listStudentAssignments`](../src/repositories/assignments.ts) carrega instruções e submissões para montar apenas os cartões exibidos. | Buscar no banco apenas os campos e períodos necessários ao resumo; agregar contagens/taxas no banco quando medido como ganho; evitar RPC por turma; paginar histórico nas páginas de detalhe.                                       | Mesmo resultado funcional e RLS; menos linhas e chamadas; p95 de `/dashboard` menor em carga.                                       |
| Listas do professor               | A [página de turmas](<../src/app/(teacher)/professor/turmas/page.tsx>) busca turmas, cursos e matrículas após o layout comum.                                                                                                                                                                                                                                           | Medir cardinalidade e tamanho de cada resposta; paginar ou filtrar apenas onde os dados reais justificarem.                                                                                                                         | Tempo e tamanho de resposta menores sem perder turmas visíveis.                                                                     |

Consultas candidatas devem ser comparadas com `pg_stat_statements` e `EXPLAIN (ANALYZE, BUFFERS)` no ambiente de testes. Criar índices **somente** para filtros e ordenações comprovadamente caros, após conferir índices existentes e custo de escrita. Não contornar RLS usando `service_role` para acelerar telas de aluno/professor. [Supabase Query Optimization](https://supabase.com/docs/guides/database/query-optimization), [Inspect the database](https://supabase.com/docs/guides/observability/inspect).

## Fase 3 — Corrigir o limite de capacidade confirmado (prioridade P1; 2–5 dias)

Esta fase depende do resultado da fase 1:

- **Se Auth ou validação JWT dominar:** avaliar chaves assimétricas e revisar renovação de sessão, sem reduzir as garantias de autenticação/autorização. Revalidar login, refresh, logout e papéis com testes automatizados.
- **Se PostgREST/Postgres dominar:** otimizar as consultas identificadas; verificar conexões ativas, esperas, bloqueios e capacidade do projeto. O código atual usa `supabase-js` sobre HTTP, então mudar a URL da aplicação para um pooler SQL não é uma correção automática. Ajustar compute/conexões somente se a medição mostrar falta de capacidade após reduzir trabalho por requisição. [Supabase Performance Tuning](https://supabase.com/docs/guides/platform/performance), [Connection Management](https://supabase.com/docs/guides/database/connection-management).
- **Se funções ou middleware da Vercel dominarem:** usar os traces para separar espera de rede, render e processamento; reduzir trabalho síncrono no caminho crítico e rever configuração de execução apenas após medir. [Vercel Debugging slow functions](https://vercel.com/docs/functions/debug-slow-functions).
- **Se proteção de borda dominar:** confirmar por logs/códigos de bloqueio. O teste não recebeu HTTP 429 ou 403; não há base para desativar proteções agora.

**Entrega:** uma correção por gargalo comprovado, com medição antes/depois e rollback documentado. Não misturar aumento de plano, cache e refatoração de consultas na mesma medição, para preservar a atribuição do ganho.

## Fase 4 — Homologação e teste de regressão (prioridade P0 antes de novo pico; 2–4 dias)

1. Criar homologação com **build, configuração de escala e volume de dados comparáveis**, separada da produção. Popular contas e dados sintéticos de aluno, professor e admin, com perfis variados. A rodada anterior usou apenas uma conta por papel; isso mede concorrência de requisições, mas não diversidade de usuários.
2. Executar o perfil k6 em patamares sustentados de 50, 150, 250, 300, 400 e 500 VUs, mantendo cada patamar por pelo menos cinco minutos. Comparar pelo menos duas execuções estáveis. Monitorar login sintético e recuperação após o fim. O script atual já interrompe em violações graves de latência, erro e iterações descartadas.
3. Medir exportação CSV e PDF separadamente; o CSV no pico anterior não completou requisições antes da interrupção, e PDF não foi incluído. Depois acrescentar, em testes isolados, escritas e Realtime, que o teste anterior não cobriu.
4. Promover as mudanças gradualmente e observar as mesmas métricas em produção com tráfego normal. Um novo teste de 500 VUs em produção deve ocorrer somente após a homologação alcançar o objetivo e com acompanhamento em tempo real.

**Critérios de aceite para 500 VUs sustentados:** zero timeouts de 60 s; zero iterações descartadas; falhas HTTP/rede abaixo de 2%; checks de autorização acima de 98%; p95 abaixo de 3 s para aluno/professor e 4 s para admin; vazão estável durante os cinco minutos; login sintético funcional durante e após o teste. Esses valores são os limites do perfil k6 atual e devem ser revisados com requisitos de negócio quando disponíveis.

## Ordem de execução e estimativa

| Ordem | Entrega                                                           | Tempo indicativo |
| ----- | ----------------------------------------------------------------- | ---------------: |
| 1     | Observabilidade, logs de erro e diagnóstico da causa              |         1–3 dias |
| 2     | Otimização do caminho comum e das consultas comprovadamente caras |         3–7 dias |
| 3     | Ajuste de Auth, banco ou funções conforme o gargalo confirmado    |         2–5 dias |
| 4     | Homologação, regressão funcional/RLS e repetição da carga         |         2–4 dias |

As estimativas são de trabalho técnico, não de calendário: a criação de homologação, disponibilidade de logs históricos e acesso às métricas da Vercel/Supabase podem alterar a sequência. O MCP do Supabase ajuda a consultar métricas e executar diagnósticos, mas não é condição para começar pela observabilidade e pelo código.
