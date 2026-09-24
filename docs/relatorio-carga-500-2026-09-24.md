# Relatório de carga autenticada — até 500 usuários virtuais

**Data:** 24/09/2026, horário de Brasília (UTC−3)
**Alvo:** produção, `https://duingles.com`, autorizada pelo responsável após confirmar que não há homologação
**Ferramenta:** k6 2.2.0, executado de uma máquina Windows
**Resultado:** capacidade degradou ao chegar a aproximadamente 300 VUs; o teste alcançou 500 VUs de navegação, mas o pico foi interrompido cedo devido a timeouts persistentes.

## Resumo executivo

O sistema respondeu bem até 150 VUs: p95 por minuto próximo de 1 s e sem erros. Durante a subida para 300 VUs, o p95 chegou a 6,5 s. No minuto seguinte, com até 350 VUs, apareceram os primeiros timeouts de 60 s em páginas autenticadas. Ao chegar a 500 VUs de navegação, a maioria das requisições concluídas naquele minuto terminou em timeout. A execução foi interrompida às 04:22:05 para limitar o impacto na produção, antes dos cinco minutos de pico planejados.

Foram registradas **10.288 requisições**, das quais **9.956 HTTP 200** e **332 falhas de rede por timeout** (3,23% no teste inteiro). Não houve HTTP 429 nem HTTP 5xx nas respostas recebidas. O p95 global foi **45,1 s**, o p99 **60 s**, e **24 iterações foram descartadas**. O objetivo de menos de 2% de falhas e ausência de iterações descartadas não foi alcançado. A média de 3,23% esconde a severidade no pico: no minuto das 04:21, **268 de 352** requisições terminadas falharam (76,1%).

Após a interrupção, a landing pública continuou respondendo HTTP 200 em cerca de 0,3 s. Às 04:24, uma tentativa de recuperação com apenas 3 VUs não conseguiu terminar o `setup()` em 60 s; um login sintético isolado também excedeu 15 s. Às 04:27, o login sintético voltou a responder HTTP 200 em 0,76 s e uma nova verificação autenticada terminou com **43 requisições, 0 falhas, 79/79 checks aprovados e p95 de 1,76 s**. Portanto, a degradação observada foi temporária, mas houve impacto no caminho autenticado por alguns minutos após parar a carga.

## Perfil executado

- Degraus de navegação: 50, 150, 300 e 500 VUs; rampa de 60 s e sustentação de 60 s entre os três primeiros degraus.
- Distribuição no alvo de 500 VUs: 350 alunos, 100 professores e 50 administradores, com navegação sequencial por páginas reais e pausas entre acessos.
- Carga adicional prevista no pico: 2 requisições de exportação CSV por segundo, com até 20 workers. Eles ficaram ocupados sob saturação; nenhuma resposta desse cenário foi concluída antes da interrupção. **Não há medição de capacidade de CSV no pico.**
- Autenticação de uma conta sintética por papel no início; as sessões foram reutilizadas pelas VUs. Não houve 500 identidades distintas.
- Somente leituras: páginas autenticadas e exportação CSV. Sem escritas, checkout, upload, Realtime ou geração/leitura de PDF. O ID de PDF não foi configurado.
- O gerador estava numa única máquina/IP. VUs representam usuários virtuais ativos, não necessariamente 500 requisições HTTP simultâneas.

## Evolução

| Hora local | VUs máximas registradas no minuto* | Requisições concluídas | Timeouts |    p95 |
| ---------- | ---------------------------------: | ---------------------: | -------: | -----: |
| 04:15      |                                 50 |                    674 |        0 |  1,0 s |
| 04:16      |                                 74 |                  1.019 |        0 |  0,9 s |
| 04:17      |                                150 |                  2.287 |        0 |  1,0 s |
| 04:18      |                                186 |                  2.829 |        0 |  1,1 s |
| 04:19      |                                300 |                  2.691 |        0 |  6,5 s |
| 04:20      |                                350 |                    377 |       44 | 60,0 s |
| 04:21      |                                518 |                    352 |      268 | 60,0 s |
| 04:22      |                                520 |                     20 |       20 | 60,0 s |

\* O total inclui até 20 workers do cenário CSV além das VUs de navegação. O máximo de **520** confirma que o perfil de **500 VUs de navegação + 20 workers adicionais** foi alcançado. A linha de 04:22 contém poucos segundos antes da interrupção. Como o timeout do cliente é de 60 s, o minuto em que uma falha aparece pode ser posterior ao início da requisição.

As requisições bem-sucedidas por minuto caíram de **2.691** às 04:19 para **377** às 04:20, enquanto VUs continuaram subindo. Esse é o sinal mais claro de perda de capacidade: as VUs ficaram esperando respostas, e não sustentaram a vazão anterior.

## Caminhos afetados

As falhas ocorreram em **todos os três perfis**: aluno (3,23% das requisições do fluxo), professor (3,25%) e admin (3,21%). Os erros no arquivo bruto têm `status=0`, `error=request timeout` e `error_code=1050`, com duração próxima de 60 s. Não são erros HTTP respondidos pelo servidor.

| Caminho                | Requisições | Falhas de rede |    p95 |
| ---------------------- | ----------: | -------------: | -----: |
| Aluno `/dashboard`     |       1.191 |    104 (8,73%) | 60,0 s |
| Aluno `/agenda`        |       1.099 |     43 (3,91%) | 53,7 s |
| Professor `/professor` |         290 |     15 (5,17%) | 60,0 s |
| Admin `/admin`         |         144 |     10 (6,94%) | 60,0 s |

O dashboard é a primeira página de cada iteração de aluno; recebe mais tentativas durante a rampa e após cada timeout. Sua taxa de falha maior **não prova** que a implementação do dashboard seja a causa inicial. A subida simultânea de latência em várias páginas e papéis aponta para um recurso compartilhado no caminho autenticado. A landing pública rápida e o login direto do Supabase temporariamente lento reforçam essa linha de investigação, mas não identificam isoladamente Vercel, Supabase Auth, banco, rede ou proteção de borda. São necessárias métricas dos provedores no mesmo intervalo.

## Onde investigar primeiro

1. **Supabase entre 04:19 e 04:27:** CPU, conexões ativas e espera no pool do Postgres, queries lentas, erros/latência de Auth e PostgREST. O login sintético direto demorou mais de 15 s às 04:25–04:26, mesmo depois de cessar a carga; às 04:27 voltou a 0,76 s. Isso merece correlação com logs e métricas do projeto.
2. **Vercel no mesmo intervalo:** duração e concorrência das funções de páginas autenticadas, timeouts, filas, memória e logs da camada de edge/middleware. Verificar o tempo de `getClaims()` e da consulta a `profiles` feita em `getSessionContext()` por render. O código usa cache dentro do mesmo render, mas cada requisição nova continua executando o caminho autenticado.
3. **Queries e índices das páginas de entrada:** medir separadamente `/dashboard`, `/professor` e `/admin` em 50, 150 e 300 VUs, com tracing por query e `EXPLAIN (ANALYZE, BUFFERS)` nas consultas mais lentas. Priorizar somente depois de confirmar qual componente satura; os p95 por rota durante o colapso refletem a saturação geral.
4. **Repetir em homologação equivalente:** criar ambiente com o mesmo build, plano e volume de dados, além de mais contas sintéticas por papel. Comparar o limite sustentável por pelo menos 5 minutos em cada patamar. A execução atual alcançou 500 VUs brevemente e não estabelece capacidade estável nesse nível.

Critério sugerido para a próxima rodada: p95 abaixo de 3 s nas páginas de aluno/professor, abaixo de 4 s no admin, falhas HTTP/rede abaixo de 2%, nenhuma iteração descartada e sem degradação de login após o teste. Esses são os limites configurados no script; o resultado desta rodada os excedeu.

## Evidências e reprodução

- [Dados brutos e relatório detalhado](../loadtest/results/diagnostic-20260924-041438-report.md) da execução principal. O `.ndjson` correspondente fica em `loadtest/results/diagnostic-20260924-041438.ndjson` e é ignorado pelo Git.
- [Verificação de recuperação](../loadtest/results/diagnostic-20260924-042740-report.md), com resumo JSON no mesmo diretório. Esses artefatos locais também são ignorados pelo Git.
- [Perfil k6](../loadtest/diagnostic-500.js), [executor PowerShell](../loadtest/run-diagnostic.ps1) e [analisador](../loadtest/analyze-results.mjs).

Comando executado, com a opção de produção autorizada:

```powershell
.\loadtest\run-diagnostic.ps1 -BaseUrl 'https://duingles.com' `
  -EnvFile '.env.local' -UsersFile 'loadtest/data/test-users.json' `
  -AllowProduction
```

O relatório da execução principal foi calculado a partir do arquivo bruto: a interrupção manual impediu o k6 de gravar o resumo JSON. Por isso, a avaliação automática de thresholds não está disponível nesse arquivo; os critérios acima foram comparados diretamente com as amostras. Nenhuma credencial ou chave foi incluída neste relatório.
