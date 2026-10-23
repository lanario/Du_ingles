# Setup do Vibe Coding Toolkit

## Registro

- Data: 2026-10-21.
- Toolkit: [`soumatheusgomes/vibe-coding-toolkit`](https://github.com/soumatheusgomes/vibe-coding-toolkit), revisão
  `790a895304e0c08b70a5b215c9d334f1c86b816c` (fonte única para prompt e guias
  desta adoção). Prompt principal: `docs/prompts/12-existing-project-setup.md`;
  atualização de harness: `docs/prompts/15-harness-improvement.md`;
  avaliação: `docs/prompts/14-harness-evaluation.md`; revisão de segurança:
  `docs/prompts/13-security-review.md`.
- Cliente observado: Codex Desktop local, projeto Windows/PowerShell. A tarefa
  foi delegada pelo agente coordenador conforme solicitado; modelo e esforço do
  subagente não foram expostos como evidência. Nenhum provedor, autenticação,
  ferramenta global ou permissão foi alterado.
- Backup: não foi criado backup separado. O checkout inicial estava limpo e os
  arquivos versionados podem ser recuperados pelo histórico/diff do Git; `.env`
  e estado local ignorado não foram alterados.
- Fonte da documentação de config do Codex: OpenAI Docs, página “Docs MCP”:
  <https://developers.openai.com/learn/docs-mcp>. Context7: guia do toolkit
  acima e CLI Codex local. Nenhuma consulta enviou código privado ou segredos.

## O que mudou

- README de template create-next-app substituído por entrada do produto,
  comandos e mapa de documentos.
- Criados `PRODUCT.md` e `docs/{architecture,design,onboarding,quality,setup}.md`;
  `CLAUDE.md` já era uma ponte funcional (`@AGENTS.md`) e foi mantido.
- `AGENTS.md` ganhou comandos reais, mapa curto, acordos e skills instaladas;
  o bloco de regras do Next gerado foi preservado literalmente.
- `.codex/config.toml` declara Context7 no escopo do projeto, sem credencial;
  `.prettierignore` e ESLint excluem somente skills de terceiros vendorizadas.
- Foram instaladas cópias locais portáveis e lockadas de 8 skills web Vercel,
  `find-skills` e `gh-fix-ci`; as duas skills Supabase preexistentes foram
  preservadas. Nenhuma aplicação/skill third-party foi copiada para código do
  produto.
- `npm update next eslint-config-next sharp` atualizou o lockfile, sem alterar
  a faixa declarada de dependências: Next e eslint-config-next 15.5.28; sharp
  0.35.5. Não houve `--force` ou downgrade.

## Cobertura do catálogo

Estados: **validado** = execução observada; **configurado sem execução** = há
arquivo/skill, mas falta teste ao vivo; **reutilizado** = já existia e foi
preservado; **não aplicável** = incompatível/sem necessidade; **pendente** = há
pré-requisito externo ou decisão posterior.

Cada linha registra a necessidade coberta, o estado encontrado, a ação e seu
escopo. Dependências, riscos e critério de validação ficam na última coluna;
em itens não aplicáveis, o critério é preservar a stack e confirmar a
incompatibilidade/ausência descrita; pendências nomeiam o próximo passo.

| Componente                         | Estado atual → ação e escopo                   | Necessidade, dependências, risco e critério de verificação                                                                                                                                                                                                                     |
| ---------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Superpowers                        | Não instalado; fallback documentado            | Skill/plugin não estava disponível. Seguir entendimento, desenho, aceite, plano e revisão proporcionais; nenhuma dependência global adicionada.                                                                                                                                |
| Subagents                          | Reutilizado nesta tarefa                       | Delegação explicitamente pedida e usada. Sem roster permanente; modelo/effort não observáveis. Próximos trabalhos: delegar somente se isolamento/especialização justificar e o usuário/fluxo permitir.                                                                         |
| RTK                                | Pendente: pré-requisito de máquina             | CLI/hook não encontrados; sem instalação global ou mudança de PATH. Usar shell normal; reavaliar em preparação da máquina.                                                                                                                                                     |
| Ponytail                           | Não instalado                                  | Plugin ausente e mudança documental não justifica adicionar plugin.                                                                                                                                                                                                            |
| Caveman                            | Não instalado                                  | Plugin ausente; usar português claro e conciso sem instalar plugin.                                                                                                                                                                                                            |
| Qualidade/lint                     | Reutilizado                                    | ESLint, TypeScript, Node test runner, arquitetura, integração e build existentes; sem regra nova que aumente dívida ou afrouxe gate.                                                                                                                                           |
| Graphify                           | Pendente: pré-requisito de máquina             | CLI não encontrado. Não criar índice externo/incompleto nem instalar globalmente. Se disponível, excluir segredos, `node_modules`, `.agents/skills`, caches e gerados; cobertura/frescor precisam ser medidos.                                                                 |
| Obsidian/memória externa           | Não aplicável                                  | Não há destino ou necessidade concreta. Memória durável fica em `AGENTS.md` e documentos versionados; handoffs permanecem por tarefa.                                                                                                                                          |
| Memória Claude                     | Reutilizado parcialmente                       | `CLAUDE.md` existente importa `AGENTS.md`; não é sistema de memória persistente. Estado `.claude/` local é ignorado pelo Git e não foi modificado.                                                                                                                             |
| Hooks                              | Não configurado                                | Nenhuma lacuna recorrente demonstrada que justifique hook; nenhuma permissão/interceptor foi acrescentado.                                                                                                                                                                     |
| agent-browser                      | Não instalado / `next-dev-loop` não aplicável  | CLI não encontrado; guia da skill exige Next ≥16.3, mas projeto permanece Next 15. Não migrar framework para habilitar skill. Browser smoke automatizado não executado.                                                                                                        |
| Context7                           | Configurado, conexão pendente                  | `.codex/config.toml` aponta ao endpoint público `https://mcp.context7.com/mcp`, sem token. `codex mcp list` mostra habilitado, `Not logged in`; falta completar autenticação caso solicitada e fazer consulta real em sessão renovada. Até validar, usar documentação oficial. |
| Skills/skill creation              | Instalado e validado localmente                | `skills@1.7.4`; `skills-lock.json` registra revisões/hashes. Nenhuma skill nova criada; `find-skills` instalado para descoberta sob necessidade.                                                                                                                               |
| Chrome DevTools MCP                | Não configurado                                | Nenhuma conexão/tool de DevTools ativa observada; não é requisito para os checks existentes. Não usar sessão pessoal.                                                                                                                                                          |
| Codex/workflow                     | Configurado parcialmente                       | `AGENTS.md`, ponte `CLAUDE.md`, setup/quality e config MCP de projeto. `codex mcp list` confirmou Supabase OAuth preexistente e Context7 habilitado sem login; sem mudança global. Skills de projeto são copiadas, não symlinks.                                               |
| Vercel skills                      | Instalado e validado                           | 8 skills web listadas abaixo e `skills-lock.json`; compatíveis com Next/React. Nenhum deploy/previews/CLI executado ou autorizado. Skill de mobile não foi instalada porque não há React Native/Expo.                                                                          |
| `next-dev-loop`                    | Não aplicável                                  | Next 15.5.28 < requisito Next 16.3 e `agent-browser` ausente. Não alterar versão principal nem bundler.                                                                                                                                                                        |
| `next-bundle-optimizer`            | Não aplicável agora                            | `next analyze --help` não expõe suporte de analyzer nesta instalação. Não há auditoria de bundle solicitada nem medição de baseline.                                                                                                                                           |
| `supabase-postgres-best-practices` | Reutilizado                                    | Skill local já existia; aplica-se a SQL/schema/migrations em Postgres, mas nenhuma alteração de banco foi feita.                                                                                                                                                               |
| `gh-fix-ci`                        | Instalado, execução pendente                   | Skill local instalado e descoberto; `gh` existe, mas `gh auth status` não encontrou login. CI remoto não foi consultado; rerun depende de autenticação autorizada.                                                                                                             |
| `differential-review`              | Não instalado; revisão manual do escopo local  | Mudança contém docs e atualização de lock; não há PR/faixa remota. Conferir diff, árvore e versões instaladas; para futura mudança de segurança sensível, instalar/usar ferramenta compatível e reportar faixa precisa.                                                        |
| shadcn/ui                          | Não aplicável                                  | Interface é customizada, sem `components.json`; preservar Tailwind/tokens/componentes existentes.                                                                                                                                                                              |
| Sentry MCP                         | Não aplicável / pendente de escolha            | Nenhum serviço/conta Sentry autorizado ou identificado; não adicionar SDK, MCP ou custo.                                                                                                                                                                                       |
| Harness2                           | Método nativo documentado, smoke não executado | Prompt 15/guia 23 registrados em `docs/quality.md`; smoke isolado não foi executado nesta tarefa. Nenhuma falha observada exige trial candidato. CLI/benchmark model-backed não selecionado (dependências, credenciais, custo e sandbox separado).                             |
| Extras/plugins                     | Avaliados, não instalados                      | Não há serviço/conta/necessidade que justifique outro plugin, UI kit, skill de artefato, template externo ou servidor próprio. Instalar deploy skill não autoriza publicar.                                                                                                    |

### Skills locais

As cópias foram instaladas com `npx skills@latest add … --agent codex --copy
--yes`, resolução `skills@1.7.4`; `skills list --agent codex --json` mostrou as 12
skills locais (10 novas e 2 existentes). Fontes revisadas no setup:

- [`vercel-labs/agent-skills`](https://github.com/vercel-labs/agent-skills), revisão
  `063bee94c3f4df8453406c830b0a7df0f2860278`, MIT: `vercel-react-best-practices`,
  `vercel-composition-patterns`, `web-design-guidelines`, `writing-guidelines`,
  `vercel-react-view-transitions`, `vercel-optimize`, `deploy-to-vercel` e
  `vercel-cli-with-tokens`.
- [`vercel-labs/skills`](https://github.com/vercel-labs/skills), revisão
  `a80e4c9d12d607631249d4d7d059f835d4b2f13a`, MIT: `find-skills`.
- [`openai/skills`](https://github.com/openai/skills), revisão
  `49f948faa9258a0c61caceaf225e179651397431`, Apache-2.0: `gh-fix-ci`.
- `supabase` e `supabase-postgres-best-practices` eram preexistentes e foram
  mantidas sem reinstalação.

Skills Vercel web aplicáveis: `vercel-react-best-practices`,
`vercel-composition-patterns`, `web-design-guidelines`, `writing-guidelines`,
`vercel-react-view-transitions`, `vercel-optimize`, `deploy-to-vercel` e
`vercel-cli-with-tokens`. `deploy-to-vercel` não muda autorização de publicação.

## Verificação antes/depois

Checkout inicial estava limpo em `main...origin/main`. Baseline antes das
mudanças: `npm run lint`, `npm run typecheck`, `npm run test:architecture`,
`npm run test:unit`, `npm run test:integration` (PostgreSQL descartável) e
`npm run build` passaram. O build local usou ambiente já configurado; nenhuma
consulta ou migração em produção foi feita.

Nenhum deploy, push, commit, alteração de conta ou acesso remoto ao CI foi
executado. O caminho `node_modules/next/dist/docs/` pedido pelo bloco Next do
`AGENTS.md` não existe nesta instalação; por isso, nenhum código de aplicação
Next foi alterado. O patch de dependências está somente no lockfile.

| Check                                             | Resultado                                                                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `skills list --agent codex --json`                | Passou; 12 skills locais descobertas.                                                                                    |
| `npm run lint`                                    | Passou depois das mudanças, sem warnings.                                                                                |
| `npm run typecheck`                               | Passou depois das mudanças.                                                                                              |
| `npm run test:architecture` / `npm run test:unit` | Ambos passaram depois das mudanças.                                                                                      |
| `npm run test:integration`                        | Passou com Docker/Testcontainers e PostgreSQL 17.                                                                        |
| `npm run build`                                   | Passou com Next.js 15.5.28; 11 páginas estáticas.                                                                        |
| Prettier direcionado aos documentos alterados     | Passou; comando exato em `docs/quality.md`.                                                                              |
| `npm run format:check`                            | Falhou em 36 arquivos preexistentes fora do formato; skills vendorizadas excluídas. Não formatar o repositório em massa. |
| `git diff --check`                                | Passou; apenas aviso Git sobre conversão LF/CRLF.                                                                        |
| `codex mcp list`                                  | Context7 aparece habilitado, `Not logged in`; sem consulta real.                                                         |
| GitHub Actions                                    | Não verificado: `gh auth status` sem login.                                                                              |
| Harness2 behavioral smoke                         | Não executado nesta sessão; não houve comparação candidata.                                                              |

### Auditoria de dependências

`npm audit` no lock inicial: 49 vulnerabilidades (36 moderadas, 12 altas, 1
crítica). `npm update next eslint-config-next sharp` resolveu patches compatíveis
na linha já usada: `next@15.5.28`, `eslint-config-next@15.5.28`, `sharp@0.35.5`;
sem `--force`. Auditoria depois: 48 (37 moderadas, 11 altas), zero críticas.
`npm audit --omit=dev --audit-level=high`: 41 (37 moderadas, 4 altas). A família
Tiptap/ProseMirror e PostCSS ainda requerem triagem e atualização controlada; o
`npm audit fix --force` propunha major Next 16 e não foi executado. A existência
de patch disponível não prova que a atualização do editor seja compatível.
Uma tentativa normal de alinhar toda a família Tiptap em 3.30.6 parou em
`ERESOLVE` por conflito de peers com versões antigas no lock; não se usou
`--force` nem `--legacy-peer-deps`, e essa tentativa não alterou manifest/lock.

## Pendências e manutenção

1. Após confiar/abrir novo contexto Codex, confirmar Context7 na descoberta e
   fazer uma consulta simples de documentação; atualizar este registro com
   resultado real.
2. Atualizar e testar conjuntamente Tiptap/ProseMirror e a dependência PostCSS
   segura, em tarefa própria; incluir o fluxo visual do planejador/editor e
   não aceitar mudança de seleção sem avaliação.
3. Repetir checks locais após patches e revisar `npm audit` quando a árvore ou
   avisos mudarem.
4. Se GitHub Actions precisar de diagnóstico, confirmar acesso `gh`/GitHub
   primeiro; não inferir status de CI local.
5. Se Context7, RTK, Graphify, browser runtime, Sentry ou outro serviço se
   tornar necessário, reavaliar pré-requisito, escopo, credenciais e política
   antes de instalar/usar.

Ao repetir adoção, consultar novamente uma única revisão atual do toolkit,
preservar personalizações e `skills-lock.json`, descobrir conteúdo novo e
atualizar somente itens cujo estado/pré-requisito/evidência mudou.
