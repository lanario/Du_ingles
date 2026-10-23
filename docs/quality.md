# Qualidade, testes e revisão

## Comandos existentes

| Comando                     | O que verifica                                       | Quando usar                                            |
| --------------------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| `npm run lint`              | ESLint no projeto                                    | Mudanças TS/TSX, docs/config ou antes de entregar      |
| `npm run typecheck`         | `tsc --noEmit`                                       | Mudanças TypeScript e contratos                        |
| `npm run test:architecture` | Direção de imports entre camadas                     | Mudança em `src/` ou estrutura                         |
| `npm run test:unit`         | Testes Node existentes com `tsx`                     | Lógica de domínio/validação afetada                    |
| `npm run test:integration`  | RLS de submissão em PostgreSQL 17 via Testcontainers | Mudanças de dados/política; requer Docker              |
| `npm run build`             | Build de produção do Next                            | Mudanças integradas e validação final                  |
| `npm run bench`             | Benchmark local da validação de questões             | Mudança no schema medido ou investigação de desempenho |

Os scripts de carga ficam em `loadtest/`; veja `docs/testing.md` e
`loadtest/README.md`. `npm run format:check` existe, mas o baseline do projeto
tem muitos arquivos antigos fora do formato do Prettier; para esta adoção, o
check geral continua informativo e não será usado para reformatar o repositório.
Skills vendorizadas em `.agents/skills/` são ignoradas pelo Prettier e ESLint
por serem fontes externas lockadas, não código do produto.

Não há script combinado `check`, suíte E2E instalada ou teste automatizado de
acessibilidade. Execute os comandos relevantes explicitamente; não declare
cobertura que não foi medida.

## Estratégia e limites

Reproduza o comportamento por contrato/fluxo, incluindo falhas e autorização.
Validação de entrada, isolamento por ator/organização/turma, upload, webhook,
export e exclusão de dados merecem teste de fronteira quando alterados. O teste
Testcontainers usa fixture reduzida, não valida todas as migrations. O CI
configurado executa arquitetura, unit, integração, lint, typecheck e build;
`npm audit` está marcado informativo (`|| true`). Acesso autenticado ao GitHub
Actions não foi possível nesta execução.

## Baseline executado nesta adoção

No checkout inicial, antes de mudanças, lint, typecheck, teste de arquitetura,
unit, integração e build passaram. Após atualizar o lock e excluir as skills
vendorizadas do lint, os mesmos comandos foram repetidos e passaram; lint
terminou sem warnings. `npm run build` completou em Next.js 15.5.28 e gerou as
11 páginas estáticas sem erro.

`npm run format:check` global continua falhando em 36 arquivos preexistentes
fora do formato, após ignorar skills de terceiros. Os documentos alterados
passaram em um check Prettier direcionado. Não aplicar formatação em massa.

## Segurança de dependências

Auditoria `npm audit` inicial reportou 49 vulnerabilidades (36 moderadas, 12
altas, 1 crítica). A resolução compatível atualizou Next e eslint-config-next
para 15.5.28 e sharp para 0.35.5, sem `--force`; a auditoria seguinte tinha 48
(37 moderadas, 11 altas) e zero críticas. `npm audit --omit=dev --audit-level=high`
reportou 41 (37 moderadas, 4 altas). Permanecem avisos de Tiptap/ProseMirror,
PostCSS e dependências transitivas. Como o editor usa `ReactNodeViewProps.selected`
e houve alteração de comportamento dessa API em uma linha posterior, uma
atualização maior da família Tiptap exige validação própria. Não use `npm audit
fix --force`; atualize/alivie os itens restantes em tarefa de dependências com
verificação de compatibilidade e editor. Uma tentativa normal de alinhar
Tiptap 3.30.6 terminou em `ERESOLVE` por conflito de peers; não se usou
`--force`/`--legacy-peer-deps` e a tentativa não alterou manifest/lock.

## Harness e revisão

Usar o método nativo inspirado em Harness2; fonte e invocação versionadas em
`docs/setup.md`. Reaproveitar casos descartáveis do [guia de avaliação na revisão
adotada](https://github.com/soumatheusgomes/vibe-coding-toolkit/blob/790a895304e0c08b70a5b215c9d334f1c86b816c/docs/07-harness-evaluation.md)
e o [prompt 14 na mesma revisão](https://github.com/soumatheusgomes/vibe-coding-toolkit/blob/790a895304e0c08b70a5b215c9d334f1c86b816c/docs/prompts/14-harness-evaluation.md)
para testar descoberta de instruções/skills, comandos, MCP e manutenção. Nesta
execução, o smoke comportamental isolado não foi rodado; não há comparação
candidata (nenhuma falha de harness observada que a justifique). O CLI oficial,
benchmarks model-backed, API paga e sandbox foram não selecionados.

Para uma revisão de segurança, use o bloco Prompt do [prompt 13 na revisão
adotada](https://github.com/soumatheusgomes/vibe-coding-toolkit/blob/790a895304e0c08b70a5b215c9d334f1c86b816c/docs/prompts/13-security-review.md);
adapte paths e faixa exata. Faça a revisão somente leitura, priorize trust
boundaries/RLS/Auth/uploads/webhooks/exports, mantenha relatório sensível fora
do Git e verifique manualmente toda alegação. Esta adoção não executou uma
revisão de segurança independente; `npm audit` não equivale a ela.

Para mudanças não triviais, revisar diff, chamadores, contratos e testes por
risco. Registrar achados confirmados, correções, checks e pendências sem afirmar
segurança absoluta. Nunca publicar/deployar por causa de uma skill de deploy.
